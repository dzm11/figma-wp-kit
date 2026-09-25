#!/usr/bin/env bash
#
# Wdrożenie motywu i treści na serwer zdalny.
#
# Zaprojektowane pod hosting współdzielony z dostępem SSH (np. MyDevil), gdzie
# nie ma Dockera ani wdrożenia z Gita, ale jest powłoka i da się uruchomić WP-CLI.
#
# Użycie:
#   npm run deploy -- bootstrap   jednorazowo: instaluje WP-CLI na serwerze
#   npm run deploy -- theme       wysyła motyw (z HEAD, nie z drzewa roboczego)
#   npm run deploy -- mu          wysyła pluginy mu (blokada indeksowania itp.)
#   npm run deploy -- media       wysyła bibliotekę mediów
#   npm run deploy -- content     wysyła bazę danych (NADPISUJE zdalną)
#   npm run deploy -- all         motyw + mu + media + baza
#   npm run deploy -- agentation  wysyła sam bundle paska uwag (podgląd staging)
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
uwaga() { printf '\033[33m%s\033[0m\n' "$*"; }

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
	git rev-parse --verify -q HEAD >/dev/null || blad "Motyw wysyłam z HEAD, a repozytorium nie ma jeszcze commita."

	# Motyw idzie z ostatniego commita, nie z drzewa roboczego: równolegli
	# agenci mogą mieć w theme/ niedokończone pliki, a na podglądzie ma być
	# tylko to, co koordynator sprawdził i zatwierdził.
	if [ -n "$(git status --porcelain -- theme)" ]; then
		uwaga "UWAGA: theme/ ma niezatwierdzone zmiany. Wysyłam motyw z HEAD ($(git rev-parse --short HEAD)), bez nich."
	fi

	local tymczasowy
	tymczasowy="$(mktemp -d)"
	# trap - RETURN: pułapka ustawiona w funkcji zostaje w powłoce i przy
	# `all` odpaliłaby się po kolejnych zadaniach, już bez zmiennej lokalnej.
	trap 'rm -rf "${tymczasowy:-}"; trap - RETURN' RETURN
	git archive HEAD theme | tar -x -C "$tymczasowy"
	[ -d "$tymczasowy/theme" ] || blad "HEAD nie zawiera katalogu theme/."

	info "Wysyłam motyw z HEAD do ${KATALOG_MOTYWU}…"
	# Wysyłamy wyłącznie to, co motyw wykonuje. Testy, zależności deweloperskie
	# i bundle paska uwag nie mają czego szukać na serwerze. Wykluczony plik
	# nie jest też kasowany przez --delete, więc bundle wysłany osobno
	# (zadanie agentation) przeżywa kolejne wdrożenia motywu.
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
		"$tymczasowy/theme/" "${CEL}:${KATALOG_MOTYWU}/"
	prostuj_uprawnienia "${KATALOG_MOTYWU}"
	ok "Motyw wysłany."
}

# ── pasek uwag (opcjonalnie) ─────────────────────────────────────────────────
zadanie_agentation() {
	local bundle="theme/assets/js/agentation.bundle.js"
	[ -f "$bundle" ] || blad "Brak $bundle — zbuduj go przez npm run agentation."

	# Tylko na podgląd: klient zgłasza uwagi paskiem wprost na stronie.
	# Motyw ładuje bundle wyłącznie w środowisku, na które pozwala
	# theme/inc/agentation.php (np. staging) — na produkcję go nie wysyłaj.
	info "Wysyłam pasek uwag (${bundle}) na podgląd…"
	"${ZDALNIE[@]}" "mkdir -p '${KATALOG_MOTYWU}/assets/js'"
	rsync -az -e "ssh -p $PORT" \
		"$bundle" "${CEL}:${KATALOG_MOTYWU}/assets/js/agentation.bundle.js"
	"${ZDALNIE[@]}" "chmod 644 '${KATALOG_MOTYWU}/assets/js/agentation.bundle.js'"
	ok "Pasek uwag wysłany."
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

	# Kroki po imporcie zależne od .env.deploy. Wartości cytuje printf %q,
	# bo hasło może zawierać znaki specjalne powłoki (zdalnie działa bash).
	local po_imporcie=""
	if [ -n "${DEPLOY_ADMIN_USER:-}" ] && [ -n "${DEPLOY_ADMIN_PASS:-}" ]; then
		# Baza lokalna ma konto admin / password — na podglądzie w sieci to
		# zaproszenie. Hasło zmieniamy przy każdym imporcie, bez maila.
		po_imporcie+="${WP_ZDALNY} user update $(printf '%q' "$DEPLOY_ADMIN_USER") --user_pass=$(printf '%q' "$DEPLOY_ADMIN_PASS") --skip-email"$'\n'
	elif [ -n "${DEPLOY_ADMIN_USER:-}${DEPLOY_ADMIN_PASS:-}" ]; then
		uwaga "UWAGA: ustaw w .env.deploy oba pola DEPLOY_ADMIN_USER i DEPLOY_ADMIN_PASS — hasło zostaje lokalne."
	fi
	if [ -n "${DEPLOY_LOCALE:-}" ]; then
		# Pliki tłumaczeń nie są w bazie — bez instalacji język by nie zadziałał.
		local jezyk
		jezyk="$(printf '%q' "$DEPLOY_LOCALE")"
		po_imporcie+="${WP_ZDALNY} language core install ${jezyk} || true"$'\n'
		po_imporcie+="${WP_ZDALNY} site switch-language ${jezyk}"$'\n'
	fi

	info "Importuję i podmieniam adresy…"
	# search-replace z WP-CLI, nie zwykły sed po SQL: WordPress trzyma część
	# danych zserializowanych, a podmiana tekstem psuje w nich długości ciągów.
	# blog_public 0: podgląd nie może trafić do wyszukiwarek, nawet jeśli
	# lokalna baza miała indeksowanie włączone (druga warstwa obok pluginu mu).
	"${ZDALNIE[@]}" bash -s <<-SKRYPT
		set -e
		${WP_ZDALNY} db import ${zdalny_zrzut}
		${WP_ZDALNY} search-replace '${DEPLOY_LOCAL_URL}' '${DEPLOY_REMOTE_URL}' --all-tables --report-changed-only
		${WP_ZDALNY} option update blog_public 0
		${po_imporcie}
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
	agentation) zadanie_agentation ;;
	*)
		blad "Użycie: npm run deploy -- {bootstrap|theme|mu|media|content|all|agentation}"
		;;
esac
