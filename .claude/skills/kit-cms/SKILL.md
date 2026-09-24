---
name: kit-cms
description: Faza 6 frameworka Figma → WordPress. Podpina zaakceptowane sekcje do CMS. Grupy pól Secure Custom Fields w PHP, typy treści dla kolekcji, strona ustawień dla danych globalnych, wartości domyślne z makiety i znikanie sekcji przy pustych polach. Użyj po akceptacji wyglądu.
---

# Faza 6: CMS

Cel: właściciel strony edytuje treść w panelu, a wygląd się nie zmienia.
Robimy to **po** akceptacji wyglądu, bo pola zaprojektowane przed poprawkami
trzeba by projektować drugi raz.

## Model treści

Masz go z fazy 2 (`docs/decyzje/rejestr.md`, sekcja ustaleń). Trzy miejsca
na dane:

| Dane | Gdzie | Jak |
|---|---|---|
| treść jednej sekcji widoku | pola na stronie widoku | grupa pól z regułą lokalizacji `page_type == front_page` (albo szablon strony) |
| powtarzalna kolekcja z własnymi podstronami | typ treści (CPT) | `register_post_type` w `inc/cpt.php`, sekcja pobiera przez `WP_Query` |
| globalne (telefon, e-mail, social, stopka, pasek ogłoszeń) | strona ustawień SCF | `inc/options.php`, `get_field( 'x', 'option' )` |

Repeater tylko dla list bez własnych podstron (np. statystyki, logotypy).

## Dla każdej sekcji

1. `theme/inc/fields/home-{slug}.php`: `acf_add_local_field_group()`,
   klucze `field_{prefiks}_home_{slug}_{pole}`, nazwy pól
   `home_{slug}_{pole}`. Dołączany automatycznie z `inc/fields/`.
2. W partialu wartość domyślna z makiety **zostaje** jako fallback.
   Strona bez wypełnionej treści wygląda jak makieta. Tak działa szkic
   i tak ma zostać.
3. **Znikanie przy pustych polach:** sekcja z kolekcją bez elementów nie
   renderuje pustej ramki. Sekcja bez treści (świadomie wyczyszczone pole
   włączające) nie renderuje się wcale. Sprawdź to przez
   `{prefiks}_section_disabled()`, furtkę działającą tylko lokalnie.
4. Obrazy: pole `image` zwraca ID, render przez `wp_get_attachment_image()`
   z `sizes`. Fallback to plik z `theme/assets/img/`.

Sekcje są rozłączne plikowo, więc mogą iść równolegle subagentami, po jednym
na 2–3 sekcje.

## Treść startowa

Kolekcje (CPT) wypełnij treścią z makiety przez WP-CLI:
`npm run wp -- post create --post_type=… --post_title=… --post_status=publish`,
obrazy przez `npm run wp -- media import`. Właściciel od razu widzi działający
panel, a strona dalej wygląda jak makieta.

## Weryfikacja

- `npm run lint:php`: 0 błędów.
- Strona po podpięciu wygląda **identycznie** jak przed. Porównaj zrzuty
  w szerokości ramek (`figma.ramki`) przed i po.
- Zmień jedną wartość w panelu przez WP-CLI i sprawdź, że widać ją na stronie.
- Stan pusty każdej sekcji z kolekcją.

Zaznacz fazę w `docs/stan.md`. Commit `Podłącz {sekcje} do CMS`.
