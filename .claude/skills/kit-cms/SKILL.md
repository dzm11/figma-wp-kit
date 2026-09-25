---
name: kit-cms
description: Faza 6 frameworka Figma → WordPress. Podpina zaakceptowane sekcje do CMS. Grupy pól Secure Custom Fields w PHP, typy treści dla kolekcji, strona ustawień dla danych globalnych, wartości domyślne z makiety i znikanie sekcji przy pustych polach. Użyj po akceptacji wyglądu.
---

# Faza 6: CMS

Cel: właściciel strony edytuje treść w panelu, a wygląd się nie zmienia.
Robimy to **po** akceptacji wyglądu, bo pola zaprojektowane przed poprawkami
trzeba by projektować drugi raz.

## Zanim zaczniesz: statyczna strona główna

Pola strony głównej muszą mieć gdzie się zapisać. Utwórz stronę „Strona
główna” i ustaw ją jako statyczną (`show_on_front=page`, `page_on_front=ID`).
Bez tego reguła `page_type == front_page` nie pokaże grupy pól nigdzie, a treść
strony głównej nie ma właściciela w panelu.

Podstrony: każda strona z listą sekcji ma w panelu szablon „Układ: {nazwa}”
(`{prefiks}-view-{slug}`, nazwy z `{prefiks}_view_labels()` i filtra). Ustaw go
każdej stronie widoku. Zmiana adresu strony nie psuje wtedy układu, a nowa
strona może dostać gotowy układ. Strony z układem mają wyłączony edytor
blokowy, bo pusty edytor sugerował redaktorowi, że tam jest treść.

## Model treści

Masz go z fazy 2 (`docs/decyzje/rejestr.md`, sekcja ustaleń). Trzy miejsca
na dane:

| Dane | Gdzie | Jak |
|---|---|---|
| treść jednej sekcji widoku | pola na stronie widoku | grupa pól z regułą `page_type == front_page` (strona główna) albo `{prefiks}_view == {widok}` (podstrona) |
| powtarzalna kolekcja (zespół, opinie, pytania, projekty) | typ treści | `{prefiks}_register_collections()` w `inc/cms.php`, funkcje dostępu w `inc/collections/{typ}.php`, sekcja pobiera przez `{prefiks}_collection( $typ, $args )` |
| globalne (telefon, e-mail, social, stopka, pasek ogłoszeń) | strona ustawień SCF | `inc/options.php`, `get_field( 'x', 'option' )` |

Repeater tylko dla list należących do jednej sekcji (statystyki, logotypy,
kroki). Lista pokazywana w kilku widokach to kolekcja.

Reguła lokalizacji podstrony:
`array( array( array( 'param' => '{prefiks}_view', 'operator' => '==', 'value' => '{widok}' ) ) )`.
Działa po widoku, nie po ID ani slugu strony, więc przeżywa zmianę adresu.

## Helpery z `inc/cms.php` i semantyka pustych pól

| Helper | Nigdy niezapisane | Zapisane puste |
|---|---|---|
| `get_field( … ) ?: __( 'z makiety' )` (pole tekstowe) | treść z makiety | **treść z makiety** |
| `{prefiks}_rows( $name, $fallback, $post_id )` (repeater) | lista z makiety | `array()`: lista znika |
| `{prefiks}_image( $id, $fallback_path, $alt, $attrs )` | plik z `theme/assets/img/` | plik z motywu |
| `{prefiks}_collection( $typ, $args )` | wpisy w kolejności `menu_order` | brak wpisów: sekcja znika |

`{prefiks}_field_saved()` odróżnia „nigdy niewypełnione” od „świadomie
wyczyszczone”. Wniosek dla redaktora: **pusty tekst nie chowa sekcji**,
chowa ją pusta lista (albo przełącznik `true_false`, jeśli sekcja nie ma
listy). Opisz to w `instructions` pola listy.

**Listy z makiety w panelu.** Niezapisany repeater jest w panelu pusty,
a pierwsze „Aktualizuj” zapisałoby pustą listę i skasowało treść z makiety.
Dlatego `{prefiks}_rows()` przy pierwszym wyświetleniu strony zapisuje listę
z makiety do pustego repeatera. Skutek: każdą stronę trzeba raz odwiedzić,
zanim redaktor otworzy ją w panelu. Po imporcie treści i po wdrożeniu
„rozgrzej” strony: `curl -s -o /dev/null` na każdy adres z `nodes.json`
(`path`) i na stronę główną.

## Dla każdej sekcji

1. `theme/inc/fields/{slug}.php`: `acf_add_local_field_group()`,
   klucze `group_{prefiks}_{slug}`, `field_{prefiks}_{pole}`, podpola
   `field_{prefiks}_{repeater}_{podpole}`. Nazwy pól takie, jakich partial już
   używa. Dołączany automatycznie z `inc/fields/`.
2. W partialu wartość domyślna z makiety **zostaje** jako fallback. Strona bez
   wypełnionej treści wygląda jak makieta. W każdym polu `placeholder` =
   wartość z makiety, żeby redaktor widział, co jest domyślnie.
3. Listy: pętla po `{prefiks}_rows()` z tablicą z makiety jako fallbackiem.
   **Nazwy podpól = klucze tablicy z makiety**, wtedy pętla się nie zmienia.
4. **Znikanie przy pustych polach:** sekcja z listą albo kolekcją bez elementów
   nie renderuje pustej ramki ani samotnego nagłówka. Sprawdź to przez
   `{prefiks}_section_disabled()`, furtkę działającą tylko lokalnie.
5. Obrazy: pole `image` z `return_format => 'id'`, render przez
   `{prefiks}_image()`. Fallback to plik z `theme/assets/img/`.
6. Sekcja `shared-*`: jedna grupa pól z regułami dla każdego widoku, w którym
   występuje. Fallback dalej z tablicy kluczowanej `{prefiks}_current_view()`.

**Menu zapasowe.** Nagłówek i stopka bez przypisanego menu WordPressa biorą
adresy przez `{prefiks}_page_url( $path )`: adres istniejącej strony albo pusty,
a wtedy link jest nieaktywny. Nigdy `#` ani adres zgadnięty: na podglądzie
właściciel musi móc przejść do każdej gotowej podstrony.

## Równolegle: kolekcje, potem widoki

Pliki sekcji są rozłączne, więc CMS też buduje wielu agentów (workflow albo
partie, zob. `kit`). Kolejność:

1. **Kolekcje** (koordynator albo jeden agent): typy treści, funkcje dostępu,
   seedy. Od nich zależą sekcje wielu widoków.
2. **Widoki**: agent na widok albo na 2–3 sekcje. Brief: helpery wyżej,
   konwencje kluczy, zakaz `wp-env start/stop/status` (zob. `kit-sekcje`),
   skrypty w `{scratchpad}/cms-{nazwa}/`, zmiany w bazie z testów cofnięte.
   `inc/cms.php` i helpery należą do koordynatora.

## Treść startowa

Kolekcje wypełnij treścią z makiety **seedem**: `tools/seed/{typ}.php`,
idempotentny (szuka wpisu po tytule albo slugu, aktualizuje zamiast dublować).
Uruchomienie:

```bash
docker cp tools/seed/{typ}.php <kontener-cli>:/tmp/seed.php
npm run wp -- eval-file /tmp/seed.php
```

Obrazy przez `npm run wp -- media import`. Właściciel od razu widzi działający
panel, a strona dalej wygląda jak makieta. Seed można powtórzyć po imporcie
bazy albo na serwerze.

## Weryfikacja

- `npm run lint:php`: 0 błędów.
- Strona po podpięciu wygląda **identycznie** jak przed. `npm run parity`
  każdej sekcji nie gorsze niż przed zmianą, zrzuty w szerokości ramek
  (`figma.ramki`) przed i po.
- Zmień jedną wartość tekstową i jeden repeater przez WP-CLI
  (`update_field`), sprawdź curlem na stronie, potem **cofnij**.
- Stan pusty każdej sekcji z listą albo kolekcją.
- Grupy pól na właściwej stronie w panelu:
  `npm run wp -- eval 'print_r( wp_list_pluck( acf_get_field_groups( array( "post_id" => ID ) ), "title" ) );'`.
- **Unikalność kluczy na żywo.** Zduplikowany klucz pola po cichu nadpisuje
  inne pole w innej grupie. Sprawdź wszystkie zarejestrowane grupy naraz:

  ```bash
  npm run wp -- eval '$k=array(); foreach ( acf_get_field_groups() as $g ) { $k[] = $g["key"]; foreach ( acf_get_fields( $g ) as $f ) { $k[] = $f["key"]; foreach ( (array) ( $f["sub_fields"] ?? array() ) as $s ) { $k[] = $s["key"]; } } } print_r( array_keys( array_filter( array_count_values( $k ), fn( $n ) => $n > 1 ) ) );'
  ```

  Wynik ma być pustą tablicą.
- Panel strony otwarty po rozgrzaniu pokazuje listy z makiety, nie puste
  repeatery.

Zaznacz fazę w `docs/stan.md`. Commit `Podłącz {sekcje} do CMS`.
