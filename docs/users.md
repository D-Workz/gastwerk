# User guides

## Manager

Sign in as manager. Management contains Ingredients, Products, Tables, Configuration & policies, Inventory and Users. Common catalog fields use forms. Advanced record exposes the complete validated document, including option groups and ingredient effects. Select a record to edit its current revision; New creates a new ID. Do not change an existing ID. Save errors leave your edited text available for correction.

For ingredients, select g, ml or piece, record reference cost per base unit if known, portions and optional low-stock threshold. Whole-piece ingredients reject fractions unless explicitly enabled. Mark allergen information reviewed only when maintained; leave unknown information unknown. Archive ingredients by disabling Active; historical orders keep their ingredient details. Base units are immutable.

For products, set base price, station, flat recipe quantities, availability and guided ordering. Category quick choices can be inherited or overridden. See [configuration examples](configuration.md) for required/optional option groups. No product-specific code is needed for juice styles or substitutions.

For stock, choose an ingredient, quantity, input unit, movement kind and reason. For a pack, also enter contents in the base unit. Only manager corrections can be negative. Entries append to the ledger; they never replace historical consumption. The balance is an estimate and may be negative. Confirm physical stock before recording a correction.

Table forms edit number, area and map coordinates. User records create/change role, active status and optional password; passwords need at least 12 characters. Saving a user invalidates their sessions. You cannot disable or demote your own account.

Configuration & policies edits pricing/rounding, reason length, category ordering, quick defaults, initial user display defaults and branding. Existing order pricing remains snapshotted. History shows closed service orders and recent attributable events. Managers may cancel a served item with a sufficiently detailed reason; this retains stock consumption and records an explicit correction.

## Waiter

1. Choose a table from the searchable list/map. The menu becomes the main workspace; Tables returns to selection without removing saved unsent items.
2. Search, filter categories or favorites. Menu context survives opening the order or product choices.
3. Add immediately saves products without choices. Otherwise choose a serving size (when multiple exist), then preparation tiles. The final tile adds to the unsent order automatically and offers Undo; it never sends to the station. Item count has separate large minus/plus controls before final selection.
4. Edit opens an in-page ingredient editor. Use configured portions, removal/restoration and quick additions. Advanced ingredients exposes search and raw quantities. Confirm deliberately saves these edits.
5. Order/Bestellung expands the full order; Menu/Speisekarte collapses it. “Not sent / Noch nicht gesendet” identifies new work. One more copies size, choices, modifications and note. Repeats of sent items create new unsent work. Rapid intentional taps are counted separately; retries are deduplicated.
6. Tap a note to expand its inline editor. Unsent notes save on blur. Sending/navigation waits for pending saves and blocks on failure, keeping the text for retry. If another waiter changed the line, review its saved note and use the explicit reviewed/retry action. Submitted notes require “Save note amendment”; preparing/ready notes require Replace.
7. Send order sends only the displayed unsent revisions. A stale revision safely blocks submission. Minus reduces only unsent quantities; removing the last item offers Undo. Undo may fail safely if another session changed the item.
8. Track Preparing/Ready, mark Ready items Served, then Close order when all items are served/cancelled. History remains available to managers.

If a repeat's recipe/price changed or its choices are unavailable, review the current product in the ingredient editor. The previous price and new preview are shown. Choose valid options and explicitly confirm; nothing is silently substituted.

Different customizations are separate lines. For a quantity-two line, Edit can split one item so the other stays unchanged. Submitted edits create a visible revision; a station must refresh/review a stale item before starting it.

After preparation starts, Replace cancels the original with a reason and submits a new customized line. The original's consumption remains recorded even when ingredients might be reusable. This conservative rule can overestimate physical use; only a manager can correct stock with a reason. Cancelling before preparation consumes nothing.

Order totals are informational EUR values, not payments or fiscal receipts. Closing frees the table but records no payment.

## Kitchen and bar

Sign in with the account for your station. Submitted tickets show table, age, quantities, guided choices, ingredient changes in text and notes. Start preparing consumes the effective recipe exactly once. Mark ready completes preparation without another deduction. Waiters mark served.

The queue refreshes approximately every two seconds. Amendments and cancellations appear explicitly, with revisions and recent change events. If another user edits a ticket before you start, the stale action returns a conflict; review the refreshed version. Replacements appear as new submitted tickets alongside the cancelled original.

Known allergens and incomplete information are visible in details. This app makes no guarantee about cross-contact or allergen safety.

## Connection and conflicts

The connection indicator reports the last successful server state fetch. A disconnected device never claims an order was sent. A mutation without an acknowledgement shows Retry. Retrying uses the same request key even if the first request actually committed, preventing duplicate effects. The retry dialog stays available across a refresh in that tab; reconnect before retrying. Do not clear tab session storage to work around a pending operation.

A revision conflict is different from a network failure: refresh, inspect the current item and deliberately reapply your intended edit. No stale edit silently overwrites another user's work. Negative stock is a warning, not an automatic availability switch; manual product availability is authoritative.

If a station starts preparation (or another session cancels an item) while you are typing a submitted note, your unsaved text remains visible for copying. It cannot amend that ticket silently. Copy it for an explicit replacement if needed, then use Discard unsaved note to leave the blocked edit. Discard changes only the unsaved text, never the saved ticket.
