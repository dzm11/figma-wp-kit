#!/usr/bin/env bash
#
# Wdrożenie motywu i treści na serwer zdalny.
#
# Zaprojektowane pod hosting współdzielony z dostępem SSH (np. MyDevil), gdzie
# nie ma Dockera ani wdrożenia z Gita, ale jest powłoka i da się uruchomić WP-CLI.
#
# Użycie:
#   npm run deploy -- bootstrap   jednorazowo: instaluje WP-CLI na serwerze
#   npm run deploy -- theme       wysyła motyw
#   npm run deploy -- mu          wysyła pluginy mu (blokada indeksowania itp.)
#   npm run deploy -- media       wysyła bibliotekę mediów
#   npm run deploy -- content     wysyła bazę danych (NADPISUJE zdalną)
#   npm run deploy -- all         motyw + mu + media + baza
#
# Konfiguracja: .env.deploy (wzór w .env.deploy.example).
# Katalog motywu na serwerze to slug z projekt.json.
# Opis i uzasadnienia: docs/wdrozenie.md.

set -euo pipefail

KATALOG_PROJEKTU="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$KATALOG_PROJEKTU"

# Na Macach z Apple Silicon natywne (arm64) docker i narzędzia leżą
# w /opt/homebrew/bin — binarki spod /usr/local/bin bywają wersjami x86
# pod Rosettą bez wtyczki compose. Dokładamy ścieżkę tylko, gdy istnieje.
if [ -d /opt/homebrew/bin ]; then
	export PATH="/opt/homebrew/bin:$PATH"
fi

blad() { printf '\033[31m%s\033[0m\n' "$*" >&2; exit 1; }
info() { printf '\033[36m%s\033[0m\n' "$*"; }
ok()   { printf '\033[32m%s\033[0m\n' "$*"; }

[ -f projekt.json ] || blad "Brak projekt.json w katalogu projektu."
SLUG="$(node -p "require('./projekt.json').slug" 2>/dev/null || true)"
[ -n "$SLUG" ] && [ "$SLUG" != "undefined" ] || blad "Nie odczytałem sluga z projekt.json."

[ -f .env.deploy ] || blad "Brak .env.deploy — skopiuj .env.deploy.example i uzupełnij."
# shellcheck disable=SC1091
set -a; . ./.env.deploy; set +a

for zmienna in DEPLOY_SSH_HOST DEPLOY_SSH_USER DEPLOY_REMOTE_WP DEPLOY_REMOTE_URL DEPLOY_LOCAL_URL; do
	[ -n "${!zmienna:-}" ] || blad "Brak zmiennej $zmienna w .env.deploy"
done

PORT="${DEPLOY_SSH_PORT:-22}"
CEL="${DEPLOY_SSH_USER}@${DEPLOY_SSH_HOST}"
ZDALNIE=(ssh -p "$PORT" "$CEL")
KATALOG_MOTYWU="${DEPLOY_REMOTE_WP}/wp-content/themes/${SLUG}"

# WP-CLI instalujemy do ~/bin, bo na hostingu współdzielonym nie ma go globalnie.
WP_ZDALNY="\$HOME/bin/wp --path=${DEPLOY_REMOTE_WP}"

# Uprawnienia prostujemy PO stronie serwera, nie przez rsync --chmod: rsync
# dostarczany z macOS jest w wersji 2.6.9 i tej opcji nie zna. Bez tego kroku
# katalog z lokalnymi uprawnieniami 700 daje na hostingu błąd 403 przy każdym
# pliku — media i arkusze po prostu się nie wczytują.
prostuj_uprawnienia() {
	local sciezka="$1"
	"${ZDALNIE[@]}" "find '$sciezka' -type d -exec chmod 755 {} + ; find '$sciezka' -type f -exec chmod 644 {} +"
}

# ── bootstrap ────────────────────────────────────────────────────────────────
zadanie_bootstrap() {
	info "Instaluję WP-CLI na serwerze…"
	"${ZDALNIE[@]}" bash -s <<-'SKRYPT'
		set -e
		mkdir -p "$HOME/bin"
		curl -sSL -o "$HOME/bin/wp" \
			https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar
		chmod +x "$HOME/bin/wp"
		"$HOME/bin/wp" --version
	SKRYPT
	ok "WP-CLI gotowe."
}

# ── motyw ────────────────────────────────────────────────────────────────────
zadanie_motyw() {
	info "Wysyłam motyw do ${KATALOG_MOTYWU}…"
	# Wysyłamy wyłącznie to, co motyw wykonuje. Testy, zależności deweloperskie
	# i bundle paska uwag nie mają czego szukać na serwerze.
	rsync -az --delete \
		-e "ssh -p $PORT" \
		--exclude='tests/' \
		--exclude='vendor/' \
		--exclude='node_modules/' \
		--exclude='composer.json' \
		--exclude='composer.lock' \
		--exclude='phpcs.xml' \
		--exclude='.gitkeep' \
		--exclude='.DS_Store' \
		--exclude='assets/js/agentation.bundle.js' \
		theme/ "${CEL}:${KATALOG_MOTYWU}/"
	prostuj_uprawnienia "${KATALOG_MOTYWU}"
	ok "Motyw wysłany."
}

# ── pluginy mu ──────────────────────────────────────────────────────────────
zadanie_mu() {
	info "Wysyłam pluginy mu…"
	# Kod, który musi działać niezależnie od aktywnego motywu: blokada
	# indeksowania podglądu i podmiana adresu przy tunelu.
	rsync -az --delete -e "ssh -p $PORT" \
		--exclude='.DS_Store' \
		mu-plugins/ "${CEL}:${DEPLOY_REMOTE_WP}/wp-content/mu-plugins/"
	prostuj_uprawnienia "${DEPLOY_REMOTE_WP}/wp-content/mu-plugins"
	ok "Pluginy mu wysłane."
}

# Nazwa kontenera WordPressa TEGO projektu. wp-env nazywa kontenery od
# katalogu instalacji (np. wp-env-projekt-1a2b3c4d-wordpress-1); przy kilku
# projektach uruchomionych naraz „pierwszy pasujący” byłby loterią.
kontener_wordpressa() {
	local instalacja
	instalacja="$(npx --no-install wp-env status --json 2>/dev/null \
		| node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const l=s.trim().split("\n").pop();try{process.stdout.write(JSON.parse(l).installPath||"")}catch{}})')"
	[ -n "$instalacja" ] || return 0
	local nazwa
	nazwa="$(basename "$instalacja" | tr '[:upper:]' '[:lower:]')-wordpress-1"
	docker ps --filter "name=^${nazwa}\$" --format '{{.Names}}' | head -1
}

# ── media ────────────────────────────────────────────────────────────────────
zadanie_media() {
	info "Pobieram bibliotekę mediów z kontenera…"
	local tymczasowy
	tymczasowy="$(mktemp -d)"
	trap 'rm -rf "$tymczasowy"' RETURN

	local kontener
	kontener="$(kontener_wordpressa)"
	[ -n "$kontener" ] || blad "Nie znalazłem kontenera WordPressa tego projektu — uruchom npm run env:start."

	docker cp "${kontener}:/var/www/html/wp-content/uploads/." "$tymczasowy/"

	info "Wysyłam media…"
	rsync -az -e "ssh -p $PORT" \
		"$tymczasowy/" "${CEL}:${DEPLOY_REMOTE_WP}/wp-content/uploads/"
	prostuj_uprawnienia "${DEPLOY_REMOTE_WP}/wp-content/uploads"
	ok "Media wysłane."
}

# ── treść ────────────────────────────────────────────────────────────────────
zadanie_tresc() {
	printf '\033[33m%s\033[0m\n' "UWAGA: to NADPISZE całą bazę danych na ${DEPLOY_REMOTE_URL}."
	read -r -p "Wpisz 'tak', żeby kontynuować: " potwierdzenie
	[ "$potwierdzenie" = "tak" ] || blad "Przerwane."

	local zrzut
	zrzut="/tmp/${SLUG}-$(date +%Y%m%d-%H%M%S).sql"
	local zdalny_zrzut="/tmp/${SLUG}-import.sql"

	info "Eksportuję bazę lokalną…"
	npm run --silent wp -- db export - > "$zrzut"
	info "Rozmiar zrzutu: $(du -h "$zrzut" | cut -f1)"

	info "Wysyłam zrzut…"
	scp -q -P "$PORT" "$zrzut" "${CEL}:${zdalny_zrzut}"

	info "Importuję i podmieniam adresy…"
	# search-replace z WP-CLI, nie zwykły sed po SQL: WordPress trzyma część
	# danych zserializowanych, a podmiana tekstem psuje w nich długości ciągów.
	"${ZDALNIE[@]}" bash -s <<-SKRYPT
		set -e
		${WP_ZDALNY} db import ${zdalny_zrzut}
		${WP_ZDALNY} search-replace '${DEPLOY_LOCAL_URL}' '${DEPLOY_REMOTE_URL}' --all-tables --report-changed-only
		${WP_ZDALNY} cache flush || true
		${WP_ZDALNY} rewrite flush || true
		rm -f ${zdalny_zrzut}
	SKRYPT

	rm -f "$zrzut"
	ok "Treść wdrożona."
}

case "${1:-}" in
	bootstrap) zadanie_bootstrap ;;
	theme)     zadanie_motyw ;;
	mu)        zadanie_mu ;;
	media)     zadanie_media ;;
	content)   zadanie_tresc ;;
	all)       zadanie_motyw; zadanie_mu; zadanie_media; zadanie_tresc ;;
	*)
		blad "Użycie: npm run deploy -- {bootstrap|theme|mu|media|content|all}"
		;;
esac
