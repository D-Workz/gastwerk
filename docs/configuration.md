# Configuration and editable policies

Managers open Management → Configuration & policies. Configuration has two versions: `data.version` identifies the schema (currently 1), while the enclosing record revision protects concurrent edits. Save uses the revision that was loaded; a concurrent manager change returns a conflict.

## Pricing and correction policy

The default document has these operational settings:

```json
{
  "version": 1,
  "rounding": "half-up",
  "additionPricing": "per-portion",
  "removalPricing": "no-refund",
  "servedCorrectionReasonMin": 5,
  "branding": "Gastwerk",
  "categories": [
    {
      "id": "food",
      "name": { "de": "Speisen", "en": "Food" },
      "quick": ["cheese"]
    },
    {
      "id": "drinks",
      "name": { "de": "Getränke", "en": "Drinks" },
      "quick": []
    }
  ],
  "display": {
    "language": "de",
    "tables": "list",
    "menu": "tiles",
    "density": "comfortable",
    "favorites": []
  }
}
```

- `rounding`: `half-up` or `half-even`, applied to the final per-item EUR price.
- `additionPricing`: `per-portion` charges each started portion; `proportional` scales by added quantity. For a 20 g portion costing €1, adding 30 g costs €2 or €1.50 respectively.
- `removalPricing`: `no-refund` or `proportional-refund`. Refunds use the configured portion surcharge, not ingredient cost. The final item price cannot fall below zero.
- `servedCorrectionReasonMin`: minimum trimmed reason length for manager correction of a served item, between 1 and 100 characters.
- Category array order determines menu category order. A product's `quick: null` inherits category choices; `quick: []` intentionally pins none.
- Display defaults initialize new users. Existing saved preferences remain their own overrides. Changing defaults does not erase those preferences.

Existing order lines preserve pricing policy, recipe and base price. A policy change applies to new selections, including replacements. Inventory timing and conservative replacement are fixed milestone rules; changing them requires a deliberate domain-policy extension and tests.

## Catalog editing

Ingredients, products and tables have forms for common fields plus an Advanced record editor for the complete JSON contract. Record IDs are stable; edits require the current version. The advanced editor is also the milestone-one editor for guided option groups. Invalid data is rejected by the server.

Decimal strings in configuration/API documents use a dot, e.g. `"20.5"`. Interface output is locale formatted. Reference cost is EUR per base unit, not purchase-pack cost. `allergens: null` means unknown; `allergens: []` means an explicit empty declaration. Neither implies absence of cross-contact.

Example cheese portion:

```json
{
  "id": "slice",
  "name": { "de": "Scheibe 20 g", "en": "Slice 20 g" },
  "quantity": "20",
  "surcharge": "1.00"
}
```

An ingredient without portions needs an explicit quantity in the advanced waiter picker. Without any configured surcharge, additions are labelled “No surcharge.” When an explicit quantity uses an ingredient with portions but no portion ID, its first portion supplies the pricing basis. Waiters cannot enter arbitrary prices.

A table record:

```json
{ "id": "t3", "number": "3", "area": "Innen", "x": 15, "y": 60, "active": true }
```

Coordinates are percentages from 0 to 90, edited in the table form. Table numbers are unique. Close an open service order before archiving its table.

## Guided choices

Products have ordered `groups` arrays. Groups are single-choice; `required` controls minimum selection (1 or 0), maximum is always 1. Groups appear as sequential in-page tile steps. `defaultChoice` is either a valid choice ID or null. Products with groups open these steps from Add. Products without groups or multiple sizes add immediately. The legacy `guided` field remains accepted for compatibility; required groups without defaults still require it when saving the catalog.

The seeded apple juice uses base recipe `{"juice":"500"}` and this required group:

```json
{
  "id": "style",
  "name": {
    "de": "Wie möchtest du den Saft?",
    "en": "How would you like your juice?"
  },
  "required": true,
  "defaultChoice": null,
  "choices": [
    {
      "id": "pure",
      "name": { "de": "Pur", "en": "Pure juice" },
      "adjustment": "0",
      "effects": []
    },
    {
      "id": "still",
      "name": { "de": "Still", "en": "Still water" },
      "adjustment": "0",
      "effects": [
        { "ingredientId": "juice", "kind": "replace", "quantity": "250" },
        { "ingredientId": "still", "kind": "add", "quantity": "250" }
      ]
    },
    {
      "id": "sparkling",
      "name": { "de": "Sprudel", "en": "Sparkling" },
      "adjustment": "0",
      "effects": [
        { "ingredientId": "juice", "kind": "replace", "quantity": "250" },
        { "ingredientId": "sparkling", "kind": "add", "quantity": "250" }
      ]
    }
  ]
}
```

For an optional group set `required: false` and `defaultChoice: null`. A choice can adjust price and add, remove or replace quantities. `replace` sets that ingredient's quantity; a substitution between ingredients needs effects for both ingredients. Array order defines effect order. Explicit waiter edits apply afterwards as final ingredient quantities. Changing choices after explicit edits raises a review prompt rather than discarding those edits.

Product `station` is `kitchen` or `bar`; these are the two station identities in milestone one. Assign a station account its matching role. Managers can work at either station. Unknown station identities are rejected.

## Migration

Do not change `version` to an unsupported value. Add a validated migration when extending the schema; convert stored documents transactionally, preserve audit records and old order snapshots, and then switch the accepted schema. Document semantic policy changes and add regression tests for old versus new lines.

## Serving sizes (milestone two)

In Management → Products → Advanced record, configure `sizes`. `[]` keeps the original recipe and price. One configured size is selected implicitly; multiple sizes appear before preparation tiles. Every size has a stable ID, translated name, optional discreet volume label, explicit recipe and absolute price. Choice adjustments still apply after that price. A size's `effects[groupId][choiceId]` overrides that choice's complete effect list; omitted entries retain the base effects. An empty effect list deliberately applies no effects.

For the apple product above, this example creates a small and large serving:

```json
{
  "sizes": [
    {
      "id": "small",
      "name": { "de": "Klein", "en": "Small" },
      "volume": "250 ml",
      "price": "3.00",
      "recipe": { "juice": "250" },
      "effects": {
        "style": {
          "still": [
            { "ingredientId": "juice", "kind": "replace", "quantity": "125" },
            { "ingredientId": "still", "kind": "add", "quantity": "125" }
          ],
          "sparkling": [
            { "ingredientId": "juice", "kind": "replace", "quantity": "125" },
            { "ingredientId": "sparkling", "kind": "add", "quantity": "125" }
          ]
        }
      }
    },
    {
      "id": "large",
      "name": { "de": "Groß", "en": "Large" },
      "volume": "500 ml",
      "price": "4.50",
      "recipe": { "juice": "500" },
      "effects": {}
    }
  ]
}
```

These are demonstration prices, available on the separate `apple-sizes-demo` seed product. Managers must choose actual sizes/prices for existing catalog items; migration does not invent them. Check every preparation mapping for each size. Rename portion labels to meaningful staff choices such as Normal/Extra as appropriate; ingredient portions retain their exact configured quantities and surcharges. Raw quantities remain available only through Advanced ingredients in the waiter editor.

Migration 2 preserves all old orders and snapshots. It fills missing product `sizes` with `[]` and updates only untouched demo choice names. Seed remains insert-if-missing and preserves user preferences and catalog edits.

## Server environment

Application business configuration above remains database-managed. Production infrastructure variables and secret files are defined separately in the root [deployment configuration table](../../docs/deployment.md#environment-files-and-secret-files). Changing public hosts requires frontend image rebuilds; changing secret files requires coordinated role/password updates and consumer recreation. Never store server credentials in Vite variables or business configuration.
