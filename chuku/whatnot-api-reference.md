# Whatnot Seller API reference (generated from openapi.json, read 2026-11-03)

Title: Whatnot Seller API v2.0.0. Servers: https://api.whatnot.com/seller-api/rest/v2

## Security scheme `OAuth2`: oauth2 OAuth 2.0 authorization code flow against the Seller API's own authorization server.
- flow authorizationCode: authorizationUrl=https://api.whatnot.com/seller-api/rest/oauth/authorize tokenUrl=https://api.whatnot.com/seller-api/rest/oauth/token refreshUrl=None
  - scope `read:inventory`: Read your product inventory
  - scope `write:inventory`: Write to your product inventory
  - scope `read:merchandising`: Read how and where your products are sold
  - scope `write:merchandising`: Change how and where your products are sold
  - scope `read:orders`: Read your orders
  - scope `write:orders`: Write to your orders
  - scope `read:shipments`: Retrieve your shipment details
  - scope `write:shipments`: Make changes to your shipments (including generating a shipping label)
  - scope `read:customers`: Read your customer's information such as address, email, and phone number
  - scope `read:reports`: Read your financial reports
  - scope `write:reports`: Generate reports about your finances
  - scope `read:shows`: Read your shows

## Endpoints

### GET /
**Health check** · scopes: (none) · tags: 
Returns the current status of the Seller API v2.
- 200: Successful Response -> RootResponse
- 503: Service is unavailable (killswitch disabled).

### GET /analytics/shows/{show_id}
**Get show analytics** · scopes: (none) · tags: Analytics
Retrieve the analytics for one show owned by the authenticated seller. A show without final analytics still returns 200 with null metrics and a `calculation_status` saying why: WILL_NOT_BE_CALCULATED if the show was cancelled, is private or is a rehearsal, NOT_ENDED if it has not ended, PENDING if it ended and the metrics are still being calculated. Requires read:reports.
Parameters: `show_id` (path, string (uuid), required): The show's ID.
- 200: Successful Response -> ShowAnalytics
- 404: No such show, or it belongs to another seller.
- 422: Validation Error -> HTTPValidationError

### POST /inventory/adjust
**Adjust inventory** · scopes: (none) · tags: Inventory
Change variants' available quantity by a delta.
Request body: AdjustInventoryLevelsRequest
- 207: Per-item results, in input order. -> InventoryBatchResult
- 403: Inventory writes are not enabled for this seller.
- 422: The request failed validation.

### POST /inventory/set
**Set inventory** · scopes: (none) · tags: Inventory
Set variants' available quantity to an absolute value.
Request body: SetInventoryLevelsRequest
- 207: Per-item results, in input order. -> InventoryBatchResult
- 403: Inventory writes are not enabled for this seller.
- 422: The request failed validation.

### POST /merchandising/products/{product_id}
**Update a product's merchandising** · scopes: (none) · tags: Merchandising
Set a product's sale format, the shows it appears in, and whether it is reserved for live, in one call. Omitted fields are left unchanged. A buy-it-now product that is not reserved for live is listed on the seller's profile shop. A draft product is published by the first call that sets the sale format, sets reserve_for_live, or adds it to shows. Publishing needs every variant priced, inventory, a description, an image, a value for each required category attribute and, in markets that require them, a dimension profile with dimensions. Anything missing is returned together in errors. Requires write:merchandising.
Parameters: `product_id` (path, string, required): The product's ID.
Request body: MerchandiseProductRequest
- 200: Successful Response -> MerchandiseProductResponse
- 403: The seller is not approved to manage inventory.
- 404: Product not found.
- 422: The merchandising change could not be applied. When a product isn't ready to publish, errors lists each field to fix.

### GET /merchandising/products/{product_id}
**Get a product's merchandising** · scopes: (none) · tags: Merchandising
Get how and where a product is currently being sold: its sale format, whether it is reserved for live, and whether it is assigned to any upcoming or live show. A buy-it-now product that is not reserved for live is listed for sale on the seller's profile shop. List the assigned shows at GET /merchandising/products/{product_id}/shows. Requires read:merchandising.
Parameters: `product_id` (path, string, required): The product's ID.
- 200: Successful Response -> ProductMerchandising
- 404: Product not found.
- 422: Validation Error -> HTTPValidationError

### GET /merchandising/products/{product_id}/shows
**List a product's shows** · scopes: (none) · tags: Merchandising
List the upcoming or live shows the product is assigned to, by scheduled start time, latest first by default; set reverse=false for earliest first. Ended and cancelled shows are not listed. Only the product's 250 most recent show assignments are considered. Requires read:merchandising and read:shows.
Parameters: `product_id` (path, string, required): The product's ID.; `limit` (query, integer): Maximum results per page.; `cursor` (query, string | null): Cursor from the previous page.; `reverse` (query, boolean): Return descending order when true; ascending when false.
- 200: Successful Response -> PageResponse_Show_
- 404: Product not found.
- 422: Invalid limit, cursor, or reverse flag.

### GET /orders/{order_id}
**Get an order** · scopes: (none) · tags: Orders
Retrieve an order sold by the authenticated seller. Requires read:orders.
Parameters: `order_id` (path, string, required): The order's ID.
- 200: Successful Response -> Order
- 404: Order not found.
- 422: Validation Error -> HTTPValidationError

### GET /orders/{order_id}/items/{item_id}
**Get an order item** · scopes: (none) · tags: Orders
Retrieve an item on an order sold by the authenticated seller. Requires read:orders.
Parameters: `order_id` (path, string, required): The order's ID.; `item_id` (path, string, required): The order item's ID.
- 200: Successful Response -> OrderItem
- 404: Order item not found.
- 422: Validation Error -> HTTPValidationError

### GET /orders
**List orders** · scopes: (none) · tags: Orders
List orders newest first by default; set reverse=false for oldest first. Offers that were never accepted aren't listed. Requires read:orders.
Parameters: `limit` (query, integer): Maximum results per page.; `cursor` (query, string | null): Cursor from the previous page.; `reverse` (query, boolean): Return descending order when true; ascending when false.
- 200: Successful Response -> PageResponse_Order_
- 422: Invalid limit, cursor, or reverse flag.

### GET /orders/{order_id}/items
**List order items** · scopes: (none) · tags: Orders
List an order's items newest first by default; set reverse=false for oldest first. Requires read:orders.
Parameters: `order_id` (path, string, required): The order's ID.; `limit` (query, integer): Maximum results per page.; `cursor` (query, string | null): Cursor from the previous page.; `reverse` (query, boolean): Return descending order when true; ascending when false.
- 200: Successful Response -> PageResponse_OrderItem_
- 404: Order not found.
- 422: Invalid limit, cursor, or reverse flag.

### POST /orders/{order_id}/cancel
**Cancel an order** · scopes: (none) · tags: Orders
Cancel an order that hasn't been fulfilled, and return the order afterwards. Requires write:orders.
Parameters: `order_id` (path, string, required): The order's ID.
Request body: CancelOrderRequest
- 200: Successful Response -> Order
- 404: Order not found.
- 409: The order can't be cancelled.
- 422: Validation Error -> HTTPValidationError

### POST /products
**Create a product** · scopes: (none) · tags: Products
Create a product in the seller's catalog. Whatnot creates one variant for every combination of the product's option values, or a single variant when it has no options. Variants start without a price or inventory, so the product is not on sale until you price them, set their inventory, and merchandise the product.
Request body: CreateProductRequest
- 201: The product was created. -> Product
- 403: The seller is not approved to create products, or product creation is not enabled for them.
- 422: The request failed validation.

### GET /products
**List products** · scopes: (none) · tags: Products
List the authenticated seller's products, newest first by default.
Parameters: `limit` (query, integer): Maximum results per page.; `cursor` (query, string | null): Cursor from the previous page.; `reverse` (query, boolean): Return descending order when true; ascending when false.
- 200: Successful Response -> PageResponse_Product_
- 422: The pagination parameters are invalid.

### PATCH /products/{product_id}
**Update a product** · scopes: (none) · tags: Products
Partially update a product; omitted fields are unchanged. Use merchandising APIs to update the transaction type, add to shows, or make available for sale on your profile shop.
Parameters: `product_id` (path, string, required): The product's ID.
Request body: UpdateProductRequest
- 200: Successful Response -> Product
- 403: The seller is not approved to update products, or product updates are not enabled for them.
- 404: Product not found.
- 422: The request failed validation.

### GET /products/{product_id}
**Get a product** · scopes: (none) · tags: Products
Fetch a single product owned by the authenticated seller.
Parameters: `product_id` (path, string, required): The product's ID.
- 200: Successful Response -> Product
- 404: Product not found.
- 422: Validation Error -> HTTPValidationError

### DELETE /products/{product_id}
**Delete a product** · scopes: (none) · tags: Products
Delete a product from the seller's catalog.
Parameters: `product_id` (path, string, required): The product's ID.
- 204: The product was deleted.
- 404: Product not found.
- 409: The product cannot be deleted in its current state.
- 422: Validation Error -> HTTPValidationError

### PATCH /products/{product_id}/variants
**Update product variants** · scopes: (none) · tags: Products
Partially update one or more of a product's variants; omitted fields are unchanged. `media` replaces a variant's image with one item; a variant image cannot be removed. A new image is ingested asynchronously and may be missing from this response. With allow_partial_updates, valid variants are applied and the rest are returned in errors. Without it, any invalid variant rejects the whole batch.
Parameters: `product_id` (path, string, required): The product's ID.
Request body: UpdateProductVariantsRequest
- 207: The updated variants, plus per-variant errors. -> VariantBatchResult
- 404: Product not found.
- 422: The request failed validation.

### GET /products/{product_id}/variants
**List product variants** · scopes: (none) · tags: Products
List variants newest first by default; set reverse=false for oldest first.
Parameters: `product_id` (path, string, required): The product's ID.; `limit` (query, integer): Maximum results per page.; `cursor` (query, string | null): Cursor from the previous page.; `reverse` (query, boolean): Return descending order when true; ascending when false.
- 200: Successful Response -> PageResponse_ProductVariant_
- 404: Product not found.
- 422: Invalid limit, cursor, or reverse flag.

### GET /products/{product_id}/variants/{id}
**Get a product variant** · scopes: (none) · tags: Products
Parameters: `product_id` (path, string, required): The product's ID.; `id` (path, string (uuid), required): The variant's ID.
- 200: Successful Response -> ProductVariant
- 404: Variant not found.
- 422: Validation Error -> HTTPValidationError

### GET /reports/{report_id}
**Get a report** · scopes: (none) · tags: Reports and Statements
Retrieve one of the seller's report generation runs. Requires read:reports.
Parameters: `report_id` (path, string (uuid), required): The report run's ID.
- 200: Successful Response -> Report
- 404: Report not found.
- 422: Validation Error -> HTTPValidationError

### GET /reports
**List reports** · scopes: (none) · tags: Reports and Statements
List the seller's report generation runs, most recently requested first by default; set reverse=false for oldest first. Requires read:reports.
Parameters: `status` (query, enum(pending, in_progress, completed, failed, cancelled) | null): Only list runs with this status.; `limit` (query, integer): Maximum results per page.; `cursor` (query, string | null): Cursor from the previous page.; `reverse` (query, boolean): Return descending order when true; ascending when false.
- 200: Successful Response -> PageResponse_Report_
- 422: Invalid status, limit, cursor, or reverse flag.

### POST /reports
**Generate a report** · scopes: (none) · tags: Reports and Statements
Request a report generation run and return it. `report_type` selects the kind of report and the parameters it accepts. The run is created `pending`; generation happens asynchronously. When an identical request is already in flight or recently completed, that existing run is returned instead of starting a new one. Requires write:reports.
Request body: GenerateReportRequest
- 201: The run that will produce the report. -> Report
- 422: The report parameters are not valid.

### GET /shipments/{shipment_id}
**Get a shipment** · scopes: (none) · tags: Shipments
Retrieve a shipment owned by the authenticated seller. Requires read:shipments.
Parameters: `shipment_id` (path, string, required): The shipment's ID.
- 200: Successful Response -> Shipment
- 404: Shipment not found.
- 422: Validation Error -> HTTPValidationError

### GET /shipments/{shipment_id}/items/{item_id}
**Get a shipment item** · scopes: (none) · tags: Shipments
Parameters: `shipment_id` (path, string, required): The shipment's ID.; `item_id` (path, string, required): The shipment item's ID.
- 200: Successful Response -> ShipmentItem
- 404: Shipment item not found.
- 422: Validation Error -> HTTPValidationError

### GET /shipments
**List shipments** · scopes: (none) · tags: Shipments
List shipments newest first by default; set reverse=false for oldest first.
Parameters: `limit` (query, integer): Maximum results per page.; `cursor` (query, string | null): Cursor from the previous page.; `reverse` (query, boolean): Return descending order when true; ascending when false.
- 200: Successful Response -> PageResponse_Shipment_
- 422: Invalid limit, cursor, or reverse flag.

### GET /shipments/{shipment_id}/items
**List shipment items** · scopes: (none) · tags: Shipments
List active shipment items newest first by default; set reverse=false for oldest first.
Parameters: `shipment_id` (path, string, required): The shipment's ID.; `limit` (query, integer): Maximum results per page.; `cursor` (query, string | null): Cursor from the previous page.; `reverse` (query, boolean): Return descending order when true; ascending when false.
- 200: Successful Response -> PageResponse_ShipmentItem_
- 404: Shipment not found.
- 422: Invalid limit, cursor, or reverse flag.

### POST /shipments/add_tracking_code
**Add a tracking code to order items** · scopes: (none) · tags: Shipments
Ship order items under a tracking code from the seller's own label. The items move onto one shipment with the tracking code, usually a new one, so read each item's shipment afterwards. The items must ship to the same buyer and address, their shipments must not have been dropped off or shipped, and the seller must be able to use their own labels. Requires write:shipments.
Request body: AddTrackingCodeRequest
- 204: Successful Response
- 409: The order items can't take this tracking code.
- 422: Invalid request, unknown order items, or an invalid tracking code.
- 503: Seller-provided tracking codes are unavailable.

### POST /shipments/{shipment_id}/generate_label
**Request a shipping label** · scopes: (none) · tags: Shipments
Queue label generation using the shipment's saved settings. HTTP 200 means enqueued, not generated. Preflight errors are returned synchronously. Receive successful labels through the label-created webhook; worker failures are not currently exposed by this API.
Parameters: `shipment_id` (path, string, required): The shipment's ID.
- 200: Successful Response -> LabelGenerationAcceptedResponse
- 403: Seller verification required, or insufficient scope.
- 404: Shipment not found.
- 409: Shipment state, settings, or seller setup prevents generation.
- 422: Validation Error -> HTTPValidationError
- 503: Label generation is unavailable.

### GET /shipping/dimension_profiles/{dimension_profile_id}
**Get a dimension profile** · scopes: (none) · tags: Shipping
Retrieve a dimension profile owned by the authenticated seller or provided by Whatnot, including inactive profiles. Requires read:inventory.
Parameters: `dimension_profile_id` (path, string, required): The dimension profile's ID.
- 200: Successful Response -> DimensionProfile
- 404: Dimension profile not found.
- 422: Validation Error -> HTTPValidationError

### GET /shipping/dimension_profiles
**List dimension profiles** · scopes: (none) · tags: Shipping
List the seller's own active dimension profiles newest first by default; set reverse=false for oldest first. Requires read:inventory.
Parameters: `limit` (query, integer): Maximum results per page.; `cursor` (query, string | null): Cursor from the previous page.; `reverse` (query, boolean): Return descending order when true; ascending when false.
- 200: Successful Response -> PageResponse_DimensionProfile_
- 422: Invalid limit, cursor, or reverse flag.

### GET /shows/{show_id}
**Get a show** · scopes: (none) · tags: Shows
Retrieve a show owned by the authenticated seller. Requires read:shows.
Parameters: `show_id` (path, string (uuid), required): The show's ID.
- 200: Successful Response -> Show
- 404: Show not found.
- 422: Validation Error -> HTTPValidationError

### GET /shows
**List shows** · scopes: (none) · tags: Shows
List shows with the given status by scheduled start time, latest first by default; set reverse=false for earliest first. Shows without a scheduled start time are listed last. Requires read:shows.
Parameters: `status` (query, enum(scheduled, live, stopped, ended, cancelled)): Only list shows with this status. Defaults to scheduled.; `limit` (query, integer): Maximum results per page.; `cursor` (query, string | null): Cursor from the previous page.; `reverse` (query, boolean): Return descending order when true; ascending when false.
- 200: Successful Response -> PageResponse_Show_
- 422: Invalid status, limit, cursor, or reverse flag.

### GET /users/me
**Get the current user** · scopes: (none) · tags: Users
Retrieve the seller authenticated by the calling application's token.
- 200: Successful Response -> User
- 401: A valid seller API token is required.

### POST /users/disconnect
**Disconnect the current application** · scopes: (none) · tags: Users
Remove the authenticated seller's installation of the calling application and expire its tokens, including refresh tokens. Subsequent requests using this installation's tokens are unauthorized. Other installations are unaffected.
- 204: Successful Response
- 401: A valid seller API token is required.
- 500: The application could not be disconnected.


## Models

### AddTrackingCodeRequest
- `order_item_ids`: array of string (required) — The decimal IDs of the order items to ship under the tracking code.
- `tracking_code`: string (required) — The carrier's tracking code for the package.
- `carrier`: string (required) — The carrier delivering the package.

### AdjustInventoryLevelsRequest
- `items`: array of AdjustInventoryItem (required) — The variants to adjust, applied independently. At most 10 items per request.

### CancelOrderRequest
- `reason`: OrderCancellationReason (required) — The reason for cancelling the order. `break_did_not_fill` is accepted only for orders from a break.

### CreateProductRequest — The settable fields when creating a product.  Only what a seller can set on create: server-derived fields (id, url, timestamps) live on ExternalProduct and are not accepted here.
- `title`: string (required) — The product's title.
- `description`: string | null — The product's description.
- `external_id`: string | null — The seller-provided external identifier for the product.
- `category`: Category (required) — The product's category.
- `attributes`: array of ProductAttribute — The product's attribute values.
- `options`: array of ProductOption — The product's option axes (e.g. Color, Size). At most 3 options are allowed, and the product of their value counts must not exceed the seller's variant limit.
- `media`: array of Media — The product's images.
- `dimension_profile`: DimensionProfile (required) — The product's dimension profile.

### AdjustInventoryItem
- `variant_id`: string (required) — The variant's id.
- `delta`: integer (required) — The change to apply to the available quantity. A result below zero is floored at 0.
- `idempotency_key`: string (required) — Caller-supplied key that makes this item idempotent: a retried item with the same key applies at most once and reports already_applied. Keys are scoped to the seller. Use a unique key for each distinct write, such as a V4 UUID.

### AnalyticsOverviewReportParameters — Parameters for an `analytics_overview_report` run.  The report is one row per calendar day of the window.
- `report_type`: string (required) — The type of report these parameters describe.
- `start_at`: string (date-time) (required) — The start of the reported window.
- `end_at`: string (date-time) (required) — The end of the reported window. Must be after `start_at`.

### Category
- `id`: string (required) — The category's id.
- `name`: string | null — The category's display name.

### DimensionProfile — A dimension profile, also embedded in products and shipment items.  On read, the resolved profile. On create, reference an existing profile by `id`, or supply `weight` and `dimensions` (with an optional `name`) to auto-create one.
- `id`: string | null — An existing dimension profile id to reference.
- `name`: string | null — The dimension profile's name. When auto-creating a profile this is used as a name prefix, with the weight and dimensions appended.
- `weight`: Weight | null — The profile's per-item weight.
- `dimensions`: Dimensions | null — The profile's package dimensions.
- `ownership`: DimensionProfileOwnership | null — Whether the dimension profile belongs to the seller or Whatnot.
- `active`: boolean | null — Whether the dimension profile is active.

### DimensionProfileOwnership
enum: seller, whatnot

### DimensionUnit
enum: inch, feet, centimeter, meter

### Dimensions
- `length`: number (required) — The package length.
- `width`: number (required) — The package width.
- `height`: number (required) — The package height.
- `unit`: DimensionUnit (required) — The dimension unit.

### FinancialReportParameters — Parameters for a `seller_financial_report` run.
- `report_type`: string (required) — The type of report these parameters describe.
- `start_date`: string (date-time) | null — Include only transactions completed at or after this time. Defaults to one week before `end_date`.
- `end_date`: string (date-time) | null — Include only transactions completed before this time. Defaults to one week after `start_date`, or to the current hour when neither end is given.

### FixedPriceDiscount
- `type`: string (required) — A fixed amount off the order.
- `amount`: Money (required) — The amount discounted.

### FulfillmentMethod
enum: shipping, pickup

### HazardousMaterial
enum: not_hazardous, standard, lithium_battery

### InventoryBatchResult
- `results`: array of InventoryResult (required) — Per-item results, in the same order as the input items.

### InventoryResult
- `variant_id`: string (required) — The item's variant_id, echoed from input.
- `idempotency_key`: string (required) — The item's idempotency_key, echoed from input.
- `status`: enum(applied, already_applied, variant_not_found, inventory_level_not_found, inventory_not_supported) (required) — What happened to this item. enum: ['applied', 'already_applied', 'variant_not_found', 'inventory_level_not_found', 'inventory_not_supported']
- `previous_quantity`: integer | null (required) — The available quantity just before this item applied.
- `new_quantity`: integer | null (required) — The available quantity after this item.
- `warnings`: array of enum(result_clamped_to_zero) (required) — Non-fatal conditions observed while applying this item.

### LivestreamsReportParameters — Parameters for an `analytics_livestreams_report` run.  Exactly one of `all_matching` and `specific_shows` selects the shows.
- `report_type`: string (required) — The type of report these parameters describe.
- `all_matching`: MatchingShowsFilter | null — Report on every show matching the filter, most recently started first. An empty filter covers all of the seller's shows.
- `specific_shows`: SpecificShows | null — Report on exactly these shows.

### MatchingShowsFilter — Which of the seller's shows an `all_matching` report covers.
- `title`: string | null — Include only shows whose title matches this text.
- `start_time`: ShowStartTimeRange | null — Include only shows that started within this range.

### Media
- `id`: string | null — The image's id.
- `url`: string (required) — On create, the image URL to ingest. On read, the CDN URL of the ingested image.
- `alt`: string | null — The image's alt text / label, if set.

### MerchandisingTransactionType — The sale formats a merchandising call can set.
enum: buy_it_now, auction

### Money
- `amount`: string (required) — Decimal amount in major currency units, e.g. 42.00.
- `currency`: string (required) — ISO 4217 currency code.

### Order
- `id`: string (required) — The order's ID.
- `url`: string | null (required) — The url of the order in the seller's dashboard.
- `status`: OrderStatus (required) — The order's status. `pending` orders aren't ready to fulfill; fulfill `pending_fulfillment` orders.
- `show_id`: string | null (required) — The show the order was placed in; null for orders placed anywhere else.
- `transaction_type`: OrderTransactionType | null (required) — How the order was sold, if recorded. `other` covers retired formats.
- `buyer`: UserSummary | null (required) — The Whatnot user who placed the order; requires read:customers.
- `amounts`: OrderAmounts (required) — The order's monetary amounts.
- `created_at`: string (date-time) | null (required) — Creation timestamp, if recorded.
- `updated_at`: string (date-time) | null (required) — Last update timestamp, if recorded.
- `cancelled_at`: string (date-time) | null (required) — When the order was cancelled, if it was.

### OrderAmounts
- `subtotal`: Money (required) — The price of the items ordered.
- `shipping`: Money (required) — Shipping charged to the buyer.
- `tax`: Money (required) — Tax charged to the buyer.
- `applied_discount`: FixedPriceDiscount | PercentageDiscount | null (required) — The discount from the seller's coupon; null when none applied or the coupon isn't the seller's.
- `total`: Money (required) — The total the buyer paid.

### OrderCancellationReason
enum: item_damaged, item_sold, item_missing, break_did_not_fill, other

### OrderItem
- `id`: string (required) — The order item's ID.
- `order_id`: string (required) — The ID of the order containing this item.
- `product_id`: string | null (required) — The purchased product's ID, if known.
- `variant_id`: string | null (required) — The purchased variant's ID, if the product has variants.
- `product_external_id`: string | null (required) — The seller-provided external ID of the purchased product, if set.
- `variant_external_id`: string | null (required) — The seller-provided external ID of the purchased variant, if set.
- `purchased_item`: PurchasedItem | null (required) — The item as listed when it was purchased, if recorded.
- `quantity`: integer (required) — The number of units purchased.
- `unit_price`: Money (required) — The price of one unit.
- `price_includes_tax`: boolean | null (required) — Whether unit_price includes tax, if recorded.
- `shipment_id`: string | null (required) — The ID of the shipment currently containing this item, if any.

### OrderStatus
enum: pending, pending_fulfillment, completed, cancelled, failed

### OrderTransactionType
enum: buy_it_now, auction, giveaway, other

### PercentageDiscount
- `type`: string (required) — A percentage off the order.
- `amount`: Money (required) — The amount discounted.

### Product — The full representation of a product, shared by the REST v2 `get_product` response and any full-body product webhooks.
- `id`: string | null — The product's id.
- `title`: string (required) — The product's title.
- `description`: string | null — The product's description.
- `external_id`: string | null — The seller-provided external identifier for the product.
- `url`: string | null — The url of the product in the seller's inventory dashboard.
- `category`: Category | null — The product's category.
- `attributes`: array of ProductAttribute — The product's attribute values.
- `options`: array of ProductOption — The product's option axes (e.g. Color, Size).
- `media`: array of Media — The product's images.
- `dimension_profile`: DimensionProfile | null — The product's dimension profile.
- `created_at`: string (date-time) | null — When the product was created.
- `updated_at`: string (date-time) | null — When the product was last updated.

### ProductAttribute
- `id`: string (required) — The product attribute's id.
- `name`: string | null — The product attribute's display name, if the definition is known.
- `value`: string (required) — The attribute's value for this product.

### ProductMerchandising — How and where a product is currently being sold.  The seller-facing merchandising view of a product: its sale format, whether it is reserved for live, and whether it is assigned to any upcoming or live shows. The shows themselves are paginated separately at ``GET /merchandising/products/{product_id}/shows``.
- `transaction_type`: TransactionType | null (required) — The configured sale format; selects which variant pricing is used. Null when the product has no listing.
- `reserved_for_live`: boolean (required) — Whether the product is sold only in live shows. Auctions are always reserved for live. A buy-it-now product that is not reserved for live is listed for sale on the seller's profile shop.
- `active_in_shows`: boolean (required) — Whether the product is assigned to at least one upcoming or live show. List the shows at GET /merchandising/products/{product_id}/shows.

### ProductOption
- `id`: string | null — The product option's id.
- `name`: string (required) — The option's display name, e.g. 'Color'.
- `values`: array of string (required) — The option's values, e.g. ['Red', 'Blue'].

### ProductVariant
- `id`: string (required) — The variant's id.
- `product_id`: string (required) — Parent product identifier.
- `sku`: string | null (required) — Seller SKU, if set.
- `external_id`: string | null (required) — Seller external identifier, if set.
- `selected_options`: array of SelectedOption (required) — Selected product option values.
- `pricing`: VariantPricing (required) — Staged format-specific prices.
- `country_of_origin`: string | null (required) — Seller-declared country of origin.
- `inventory`: VariantInventory (required) — Default-location inventory.
- `media`: array of Media (required) — Resolved variant images.

### ProductVariantPatch — A partial variant update. Omitted fields are left unchanged.
- `id`: string (required) — The variant's id.
- `sku`: string | null — Seller SKU. Send null to clear.
- `external_id`: string | null — Seller external identifier. Send null to clear.
- `pricing`: VariantPricingInput | null — Format-specific prices to stage.
- `country_of_origin`: string | null — Seller-declared country of origin, ISO 3166-1 alpha-2.
- `media`: array of Media | null — Replaces the variant's image. Send one item. Omit the field to leave it unchanged. A variant image cannot be removed. Ingest is asynchronous, so a new image may be missing from this response.

### PurchasedItem
- `title`: string (required) — The item's title when it was purchased.
- `description`: string | null (required) — The item's description when it was purchased, if set.
- `sku`: string | null (required) — The item's SKU when it was purchased, if set.

### Report — One asynchronous report generation run.  Runs are created `pending`; generation happens asynchronously.
- `id`: string (uuid) (required) — The report run's ID.
- `report_type`: ReportType (required) — The type of report this run generates.
- `status`: ReportStatus (required) — The status of the run.
- `report_parameters`: FinancialReportParameters | AnalyticsOverviewReportParameters | LivestreamsReportParameters | null (required) — The parameters this run covers, after defaults were applied. The shape depends on `report_type`. Null when the run has no parameters.
- `report_url`: string | null (required) — URL of the generated report file. Null until the run is `completed`. See [Reports and Statements](/reports) for each report type's CSV columns.
- `created_at`: string (date-time) (required) — When the run was requested.
- `updated_at`: string (date-time) (required) — When the run was last updated.

### ReportStatus
enum: pending, in_progress, completed, failed, cancelled

### ReportType
enum: seller_financial_report, analytics_overview_report, analytics_livestreams_report

### SelectedOption
- `id`: string (required) — Stable product option identifier.
- `name`: string (required) — Product option display name.
- `value_id`: string (required) — Stable option value identifier.
- `value`: string (required) — Selected option value.

### SetInventoryItem
- `variant_id`: string (required) — The variant's id.
- `quantity`: integer (required) — The available quantity to set.
- `idempotency_key`: string (required) — Caller-supplied key that makes this item idempotent: a retried item with the same key applies at most once and reports already_applied. Keys are scoped to the seller. Use a unique key for each distinct write, such as a V4 UUID.

### Shipment
- `id`: string (required) — The shipment's ID.
- `url`: string (required) — The url of the shipment in the seller's dashboard.
- `status`: ShipmentStatus (required) — The current fulfillment status of this shipment.
- `fulfillment_method`: FulfillmentMethod (required) — The method of fulfillment for this shipment.
- `recipient`: UserSummary | null (required) — The Whatnot user receiving this shipment; requires read:customers.
- `weight`: Weight | null (required) — Package weight, if known and valid.
- `dimensions`: Dimensions | null (required) — Package dimensions, if known and valid.
- `signature_required`: boolean (required) — Whether delivery requires a signature.
- `hazardous_material`: HazardousMaterial | null (required) — The hazardous-material classification of this shipment's contents.
- `tracking`: ShipmentTracking | null (required) — Carrier and tracking information.
- `documents`: ShipmentDocuments | null (required) — The shipping documents available for this shipment; requires read:customers.
- `insurance`: ShipmentInsurance | null (required) — Shipping insurance, if present.
- `seller_paid_shipping_cost`: Money | null (required) — The seller's share of shipping across this shipment's active orders, set at checkout by the seller's shipping settings. Not the label's purchase price, and excludes later carrier adjustments. Null when none was recorded.
- `required_actions`: array of ShipmentRequiredAction (required) — Actions required before fulfillment.
- `dropoff_due`: string (date-time) | null (required) — Due date at seller-local midnight, serialized with timezone; not the overdue cutoff. Null for pickup, non-pre-transit shipments, or missing inputs.
- `replacement_shipment_id`: string | null (required) — Immediate successor shipment ID after replacement, bundling, or splitting; not the final successor in a chain.
- `created_at`: string (date-time) | null (required) — Creation timestamp, if recorded.
- `updated_at`: string (date-time) | null (required) — Last update timestamp, if recorded.

### ShipmentDocuments
- `label_url`: string | null (required) — Shipping label URL, if available. Usually hosted by the label provider, which sets how long it stays valid.
- `bundled_url`: string | null (required) — Combined label and packing slip, or pickup slip URL. This presigned URL is valid for up to 1 hour; re-fetch the shipment with `GET /shipments/{shipment_id}` for a fresh link.
- `commercial_invoice_url`: string | null (required) — Commercial invoice URL from the label provider, if one was issued.

### ShipmentInsurance
- `amount`: Money (required) — Insured value.
- `contents`: string | null (required) — Description of insured contents.

### ShipmentItem
- `id`: string (required) — The shipment item's ID; distinct from its order-item ID.
- `shipment_id`: string (required) — The ID of the shipment currently containing this item.
- `order_id`: string | null (required) — The ID of the order associated with this item, if available.
- `order_item_id`: string | null (required) — The ID of the order item associated with this shipment item, if available.
- `dimension_profile`: DimensionProfile | null (required) — The item's dimension profile, if available.
- `hazardous_material`: HazardousMaterial | null (required) — The hazardous-material classification of this item.
- `country_of_origin`: string | null (required) — Country of origin, if recorded.
- `created_at`: string (date-time) | null (required) — Creation timestamp, if recorded.
- `updated_at`: string (date-time) | null (required) — Last update timestamp, if recorded.

### ShipmentRequiredAction
enum: country_of_origin_required, itn_required, order_pending_cancellation, package_review_required

### ShipmentStatus
enum: created, label_generated, dropped_off, in_transit, delivered, failed, cancelled, cancelled_not_shipped, cancelled_not_shipped_with_dropoff, cancelled_tracking_stuck

### ShipmentTracking
- `carrier`: string | null (required) — The carrier delivering this shipment.
- `service`: string | null (required) — The carrier service used for this shipment.
- `tracking_code`: string | null (required) — The carrier's tracking code for this shipment.
- `last_mile_tracking_code`: string | null (required) — The tracking code used for the final leg of delivery.

### Show
- `id`: string (required) — The show's ID.
- `title`: string (required) — The show's title.
- `url`: string (required) — The url of the show in the seller's dashboard.
- `description`: string | null (required) — The show's description, if set.
- `status`: ShowStatus (required) — The show's lifecycle status. A stopped show can resume; an ended show cannot.
- `visibility`: ShowVisibility (required) — Whether the show is visible to everyone or only to invited viewers.
- `scheduled_start_at`: string (date-time) | null (required) — When the show is scheduled to start. Not updated when the show goes live.
- `ended_at`: string (date-time) | null (required) — When the show ended, if it has.
- `thumbnail`: Media | null (required) — The show's thumbnail image, if set.
- `created_at`: string (date-time) (required) — Creation timestamp.
- `updated_at`: string (date-time) (required) — Last update timestamp.

### ShowAnalytics
- `show_id`: string (required) — The show these analytics describe.
- `title`: string (required) — The show's title.
- `start_time`: string (date-time) (required) — When the show started.
- `calculation_status`: ShowAnalyticsStatus | null (required) — WILL_NOT_BE_CALCULATED if the show was cancelled, is private or is a rehearsal, so no analytics will ever exist. NOT_ENDED while the show has not ended, so no analytics exist yet. PENDING once it has ended but the metrics are still being calculated. GENERATED once they are final. Metrics are null unless GENERATED.
- `sales`: Money | null (required) — Gross sales.
- `estimated_earnings`: Money | null (required) — Estimated earnings; can be negative after refunds and fees.
- `orders_count`: integer | null (required) — Number of orders.
- `average_order_value`: Money | null (required) — Average order value.
- `giveaway_orders_count`: integer | null (required) — Number of giveaway orders.
- `giveaway_spend`: Money | null (required) — Amount spent on giveaways; can be negative.
- `show_impression_count`: integer | null (required) — Number of times the show was shown to viewers.
- `show_clickthrough_rate`: number | null (required) — Percentage of impressions that were tapped, to two decimal places. Null when there were no impressions.
- `buyers_count`: integer | null (required) — Number of distinct buyers.
- `first_time_buyers_count`: integer | null (required) — Buyers purchasing from the seller for the first time.
- `returning_buyers_count`: integer | null (required) — Buyers who had purchased from the seller before.
- `giveaway_winners_count`: integer | null (required) — Number of distinct giveaway winners.
- `first_time_giveaway_winners_count`: integer | null (required) — Giveaway winners who had not bought from the seller before.
- `returning_giveaway_winners_count`: integer | null (required) — Giveaway winners who had bought from the seller before.
- `buyer_shares_count`: integer | null (required) — Number of times buyers shared the show.
- `stream_minutes`: integer | null (required) — Minutes the show ran.
- `max_concurrent_viewers`: integer | null (required) — Peak number of simultaneous viewers.
- `total_views`: integer | null (required) — Total views.
- `distinct_viewers_count`: integer | null (required) — Number of distinct viewers.
- `average_rating`: number | null (required) — Average viewer rating of the show.

### ShowAnalyticsStatus
enum: WILL_NOT_BE_CALCULATED, NOT_ENDED, PENDING, GENERATED

### ShowStartTimeRange
- `start`: string (date-time) (required) — Include only shows that started at or after this time.
- `end`: string (date-time) | null — Include only shows that started at or before this time. Defaults to the end of the current hour.

### ShowStatus
enum: scheduled, live, stopped, ended, cancelled

### ShowStrategy — The public, user-facing values for reconciling a product's shows.
enum: ADD, REMOVE, REPLACE

### ShowVisibility
enum: public, private

### ShowsInput — The requested change to which shows a product appears in.
- `strategy`: ShowStrategy (required) — ADD leaves the product's other shows untouched and adds these; REMOVE takes it off these shows; REPLACE makes these the product's only shows, removing it from any others.
- `show_ids`: array of string (uuid) (required) — The shows to add or remove, by show ID. For replace, the product's complete set of shows after the call; an empty list removes it from every show.

### SpecificShows
- `show_ids`: array of string (uuid) (required) — The shows to report on, in the order their rows appear. Every show must be hosted by the seller.

### TransactionType — The public, user-facing transaction type values.
enum: buy_it_now, auction, giveaway

### User
- `id`: string (required) — The user's ID, encoded as a decimal string.
- `username`: string (required) — The user's username.
- `display_name`: string | null (required) — The user's display name, if set.
- `image`: Media | null (required) — The user's profile image, if set.
- `seller_currency`: string (required) — The seller's ISO 4217 currency code.
- `country_code`: string | null (required) — The user's ISO 3166-1 alpha-2 country code.
- `can_go_live`: boolean (required) — Whether the user is allowed to go live.

### UserSummary
- `id`: string (required) — The user's decimal ID.
- `username`: string (required) — The user's username.
- `display_name`: string | null (required) — The user's display name.

### VariantAuction
- `start_price`: Money | null (required) — Auction start price.

### VariantAuctionInput
- `start_price`: Money (required) — Auction start price, in whole currency units.

### VariantBatchResult
- `variants`: array of ProductVariant (required) — The updated variants, in input order.
- `errors`: array of VariantError | null — Patches that were not applied, in input order. Present only when allow_partial_updates is true.

### VariantBuyItNow
- `price`: Money | null (required) — Buy-it-now price.

### VariantBuyItNowInput
- `price`: Money (required) — Buy-it-now price, in whole currency units.

### VariantError
- `id`: string (required) — The patch's id, echoed from input.
- `code`: enum(variant_not_found, variant_not_editable, pricing_not_supported, variants_not_supported) (required) — Why the patch was not applied. enum: ['variant_not_found', 'variant_not_editable', 'pricing_not_supported', 'variants_not_supported']
- `message`: string (required) — A human-readable explanation.

### VariantInventory
- `available_quantity`: integer (required) — Available inventory quantity.

### VariantPricing
- `buy_it_now`: VariantBuyItNow (required)
- `auction`: VariantAuction (required)

### VariantPricingInput — Prices to stage per format. An omitted format is left unchanged.
- `buy_it_now`: VariantBuyItNowInput | null
- `auction`: VariantAuctionInput | null

### Weight
- `value`: number (required) — The weight amount.
- `unit`: WeightUnit (required) — The weight unit.

### WeightUnit — The unit used to express weight.
enum: ounce, pound, gram, kilogram

### GenerateReportRequest
- `report_parameters`: FinancialReportParameters | AnalyticsOverviewReportParameters | LivestreamsReportParameters (required) — The parameters of the report to generate. `report_type` selects the kind of report and the other fields it accepts.

### HTTPValidationError
- `detail`: array of ValidationError

### LabelGenerationAcceptedResponse
- `shipment_id`: string (required) — Shipment whose label generation was requested.

### MerchandiseProductRequest — Merchandising changes to apply to a product in a single call.  Every field is optional; an omitted field leaves that facet unchanged. The changes are applied together: transaction type first, then show membership, then profile-shop publication.
- `transaction_type`: MerchandisingTransactionType | null — The product's sale format. When provided, overwrites the format on the product. Auctions are always reserved for live and are sold only in shows; add the product to one with shows, in this call or a later one, or it is not purchasable anywhere.
- `reserve_for_live`: boolean | null — Whether the product is held for live shows only. Auctions are always reserved for live, so this is rejected as false when transaction_type is auction in the same request, and ignored for a product that is already an auction. A buy-it-now product is purchasable on the seller's profile shop only when this is not true. When omitted, the product's current choice is kept. A draft buy-it-now product with no choice yet is treated as false when transaction_type is set, which publishes it to the profile shop. Switching to auction records the product as reserved for live, so switching back to buy-it-now keeps it off the profile shop until this is sent as false.
- `shows`: ShowsInput | null — The change to which shows the product appears in. Adding a product to a show that is not among the seller's next upcoming shows is applied in the background. Omit to leave the product's shows unchanged.

### MerchandiseProductResponse — The outcome of a merchandising call for a product.
- `product_id`: string (required) — The product that was merchandised.
- `transaction_type`: TransactionType | null (required) — The product's sale format after the call.
- `reserved_for_live`: boolean (required) — Whether the product is sold only in live shows. Auctions are always reserved for live. A buy-it-now product that is not reserved for live is listed for sale on the seller's profile shop.

### PageResponse_DimensionProfile_
- `data`: array of DimensionProfile (required) — Results in the requested order.
- `next_cursor`: string | null (required) — Continuation cursor; null when there are no more results.

### PageResponse_OrderItem_
- `data`: array of OrderItem (required) — Results in the requested order.
- `next_cursor`: string | null (required) — Continuation cursor; null when there are no more results.

### PageResponse_Order_
- `data`: array of Order (required) — Results in the requested order.
- `next_cursor`: string | null (required) — Continuation cursor; null when there are no more results.

### PageResponse_ProductVariant_
- `data`: array of ProductVariant (required) — Results in the requested order.
- `next_cursor`: string | null (required) — Continuation cursor; null when there are no more results.

### PageResponse_Product_
- `data`: array of Product (required) — Results in the requested order.
- `next_cursor`: string | null (required) — Continuation cursor; null when there are no more results.

### PageResponse_Report_
- `data`: array of Report (required) — Results in the requested order.
- `next_cursor`: string | null (required) — Continuation cursor; null when there are no more results.

### PageResponse_ShipmentItem_
- `data`: array of ShipmentItem (required) — Results in the requested order.
- `next_cursor`: string | null (required) — Continuation cursor; null when there are no more results.

### PageResponse_Shipment_
- `data`: array of Shipment (required) — Results in the requested order.
- `next_cursor`: string | null (required) — Continuation cursor; null when there are no more results.

### PageResponse_Show_
- `data`: array of Show (required) — Results in the requested order.
- `next_cursor`: string | null (required) — Continuation cursor; null when there are no more results.

### RootResponse
- `status`: string (required) — Current API status.

### SetInventoryLevelsRequest
- `items`: array of SetInventoryItem (required) — The variants to set, applied independently. At most 10 items per request.

### UpdateProductRequest — The mutable fields for a partial product update.
- `title`: string | null — The product's title.
- `description`: string | null — The product's description.
- `external_id`: string | null — The seller-provided external identifier for the product.
- `category`: Category | null — The product's category.
- `attributes`: array of ProductAttribute | null — The product's attribute values.
- `options`: array of ProductOption | null — The product's option axes (e.g. Color, Size).
- `media`: array of Media | null — The product's images.
- `dimension_profile`: DimensionProfile | null — The product's dimension profile.

### UpdateProductVariantsRequest
- `variants`: array of ProductVariantPatch (required) — The variant patches, each keyed by id. At most 10 per request, and each id at most once.
- `allow_partial_updates`: boolean — When true, valid variants are applied and failures are returned in errors. When false, any invalid variant rejects the whole batch with a 422 and nothing is written.

### ValidationError
- `loc`: array of string | integer (required)
- `msg`: string (required)
- `type`: string (required)
- `input`: object
- `ctx`: object


# Webhooks (generated from webhooks/openapi.json)

Every topic Whatnot can deliver to your webhook endpoint. Each topic's page shows the headers and payload of its deliveries.

To subscribe to topics and verify deliveries, see the [Webhooks guide](/getting-started/webhooks).

### orders.created
**orders.created** · scopes: (none)
An order was placed, or for an offer, the seller accepted it. Requires read:orders.
Payload: OrderCreatedWebhookBody

### orders.updated
**orders.updated** · scopes: (none)
An order's status changed after it was placed, for example when it was cancelled or completed. Requires read:orders.
Payload: OrderUpdatedWebhookBody

### shows.created
**shows.created** · scopes: (none)
A seller scheduled a show. Rehearsals aren't sent. Requires read:shows.
Payload: ShowCreatedWebhookBody

### shows.updated
**shows.updated** · scopes: (none)
A show changed, such as its title, start time or visibility. Every update is sent, even one that only changed `updated_at`. Requires read:shows.
Payload: ShowUpdatedWebhookBody

### shows.started
**shows.started** · scopes: (none)
A show went live, including when a stopped show resumed. Requires read:shows.
Payload: ShowStartedWebhookBody

### shows.ended
**shows.ended** · scopes: (none)
A show ended, including when Whatnot ended an abandoned show. It drops out of `GET /merchandising/products/{product_id}/shows` for its products, but no `merchandising.products.removed_from_show` is sent for them. Requires read:shows.
Payload: ShowEndedWebhookBody

### shows.cancelled
**shows.cancelled** · scopes: (none)
A show was cancelled. It drops out of `GET /merchandising/products/{product_id}/shows` for its products, but no `merchandising.products.removed_from_show` is sent for them. Requires read:shows.
Payload: ShowCancelledWebhookBody

### merchandising.products.added_to_show
**merchandising.products.added_to_show** · scopes: (none)
A product was added to a show. Requires read:merchandising.
Payload: ProductAddedToShowWebhookBody

### merchandising.products.removed_from_show
**merchandising.products.removed_from_show** · scopes: (none)
A product was removed from a show, including when its listing was deleted. It isn't sent when a show is cancelled or ends; `shows.cancelled` and `shows.ended` cover those. Requires read:merchandising.
Payload: ProductRemovedFromShowWebhookBody

### shipments.created
**shipments.created** · scopes: (none)
A shipment was created for an order. Requires read:shipments.
Payload: ShipmentCreatedWebhookBody

### shipments.label_generated
**shipments.label_generated** · scopes: (none)
A shipping label was generated or regenerated for a shipment. Requires read:shipments.
Payload: ShipmentLabelGeneratedWebhookBody

### shipments.tracking_code_added
**shipments.tracking_code_added** · scopes: (none)
A shipment got a tracking code, from a purchased label, the seller's own label or a replacement. Requires read:shipments.
Payload: ShipmentTrackingCodeAddedWebhookBody

### shipments.parcel_updated
**shipments.parcel_updated** · scopes: (none)
The seller edited a shipment's parcel weight or dimensions. Adding or removing items also changes the parcel; shipments.items.added and shipments.items.removed carry the new parcel, and this webhook isn't sent for those changes. Requires read:shipments.
Payload: ShipmentParcelUpdatedWebhookBody

### shipments.items.added
**shipments.items.added** · scopes: (none)
Items joined a shipment, when orders were bundled at checkout or the seller bundled shipments. shipment_item_ids lists every item on the shipment after the change, not only the added ones. The body also carries the shipment's parcel, which changes with its items. Requires read:shipments.
Payload: ShipmentItemsAddedWebhookBody

### shipments.items.removed
**shipments.items.removed** · scopes: (none)
Items left a shipment, when it was split or unbundled or the seller bundled its items into another shipment. shipment_item_ids lists the items still on the shipment after the change, not the removed ones. The body also carries the shipment's parcel, which changes with its items. Requires read:shipments.
Payload: ShipmentItemsRemovedWebhookBody

### shipments.cancelled
**shipments.cancelled** · scopes: (none)
A shipment was cancelled by Whatnot support. Requires read:shipments.
Payload: ShipmentCancelledWebhookBody

### shipments.replaced
**shipments.replaced** · scopes: (none)
All of a shipment's items moved to a new shipment, for example when a new label was bought for it, the seller added tracking from their own label, or Whatnot support changed its label. The previous shipment is usually cancelled. The body has both shipments. Requires read:shipments.
Payload: ShipmentReplacedWebhookBody

### products.created
**products.created** · scopes: (none)
A product was created. Requires read:inventory.
Payload: ProductCreatedWebhookBody

### products.updated
**products.updated** · scopes: (none)
A product changed, including its variants, inventory or prices. The payload doesn't say which fields changed. Requires read:inventory.
Payload: ProductUpdatedWebhookBody

### products.deleted
**products.deleted** · scopes: (none)
A product was deleted. Requires read:inventory.
Payload: ProductDeletedWebhookBody


## Webhook models

### Category
- `id`: string — The category's id.
- `name`: string | null — The category's display name.

### DimensionProfile — A dimension profile, also embedded in products and shipment items.  On read, the resolved profile. On create, reference an existing profile by `id`, or supply `weight` and `dimensions` (with an optional `name`) to auto-create one.
- `id`: string | null — An existing dimension profile id to reference.
- `name`: string | null — The dimension profile's name. When auto-creating a profile this is used as a name prefix, with the weight and dimensions appended.
- `weight`: Weight | null — The profile's per-item weight.
- `dimensions`: Dimensions | null — The profile's package dimensions.
- `ownership`: DimensionProfileOwnership | null — Whether the dimension profile belongs to the seller or Whatnot.
- `active`: boolean | null — Whether the dimension profile is active.

### DimensionProfileOwnership
enum: seller, whatnot

### DimensionUnit
enum: inch, feet, centimeter, meter

### Dimensions
- `length`: number — The package length.
- `width`: number — The package width.
- `height`: number — The package height.
- `unit`: DimensionUnit — The dimension unit.

### FixedPriceDiscount
- `type`: string — A fixed amount off the order.
- `amount`: Money — The amount discounted.

### FulfillmentMethod
enum: shipping, pickup

### HazardousMaterial
enum: not_hazardous, standard, lithium_battery

### Media
- `id`: string | null — The image's id.
- `url`: string — On create, the image URL to ingest. On read, the CDN URL of the ingested image.
- `alt`: string | null — The image's alt text / label, if set.

### Money
- `amount`: string — Decimal amount in major currency units, e.g. 42.00.
- `currency`: string — ISO 4217 currency code.

### Order
- `id`: string — The order's ID.
- `url`: string | null — The url of the order in the seller's dashboard.
- `status`: OrderStatus — The order's status. `pending` orders aren't ready to fulfill; fulfill `pending_fulfillment` orders.
- `show_id`: string | null — The show the order was placed in; null for orders placed anywhere else.
- `transaction_type`: OrderTransactionType | null — How the order was sold, if recorded. `other` covers retired formats.
- `buyer`: UserSummary | null — The Whatnot user who placed the order; requires read:customers.
- `amounts`: OrderAmounts — The order's monetary amounts.
- `created_at`: string (date-time) | null — Creation timestamp, if recorded.
- `updated_at`: string (date-time) | null — Last update timestamp, if recorded.
- `cancelled_at`: string (date-time) | null — When the order was cancelled, if it was.

### OrderAmounts
- `subtotal`: Money — The price of the items ordered.
- `shipping`: Money — Shipping charged to the buyer.
- `tax`: Money — Tax charged to the buyer.
- `applied_discount`: FixedPriceDiscount | PercentageDiscount | null — The discount from the seller's coupon; null when none applied or the coupon isn't the seller's.
- `total`: Money — The total the buyer paid.

### OrderStatus
enum: pending, pending_fulfillment, completed, cancelled, failed

### OrderTransactionType
enum: buy_it_now, auction, giveaway, other

### PercentageDiscount
- `type`: string — A percentage off the order.
- `amount`: Money — The amount discounted.

### Product — The full representation of a product, shared by the REST v2 `get_product` response and any full-body product webhooks.
- `id`: string | null — The product's id.
- `title`: string — The product's title.
- `description`: string | null — The product's description.
- `external_id`: string | null — The seller-provided external identifier for the product.
- `url`: string | null — The url of the product in the seller's inventory dashboard.
- `category`: Category | null — The product's category.
- `attributes`: array of ProductAttribute — The product's attribute values.
- `options`: array of ProductOption — The product's option axes (e.g. Color, Size).
- `media`: array of Media — The product's images.
- `dimension_profile`: DimensionProfile | null — The product's dimension profile.
- `created_at`: string (date-time) | null — When the product was created.
- `updated_at`: string (date-time) | null — When the product was last updated.

### ProductAttribute
- `id`: string — The product attribute's id.
- `name`: string | null — The product attribute's display name, if the definition is known.
- `value`: string — The attribute's value for this product.

### ProductOption
- `id`: string | null — The product option's id.
- `name`: string — The option's display name, e.g. 'Color'.
- `values`: array of string — The option's values, e.g. ['Red', 'Blue'].

### Shipment
- `id`: string — The shipment's ID.
- `url`: string — The url of the shipment in the seller's dashboard.
- `status`: ShipmentStatus — The current fulfillment status of this shipment.
- `fulfillment_method`: FulfillmentMethod — The method of fulfillment for this shipment.
- `recipient`: UserSummary | null — The Whatnot user receiving this shipment; requires read:customers.
- `weight`: Weight | null — Package weight, if known and valid.
- `dimensions`: Dimensions | null — Package dimensions, if known and valid.
- `signature_required`: boolean — Whether delivery requires a signature.
- `hazardous_material`: HazardousMaterial | null — The hazardous-material classification of this shipment's contents.
- `tracking`: ShipmentTracking | null — Carrier and tracking information.
- `documents`: ShipmentDocuments | null — The shipping documents available for this shipment; requires read:customers.
- `insurance`: ShipmentInsurance | null — Shipping insurance, if present.
- `seller_paid_shipping_cost`: Money | null — The seller's share of shipping across this shipment's active orders, set at checkout by the seller's shipping settings. Not the label's purchase price, and excludes later carrier adjustments. Null when none was recorded.
- `required_actions`: array of ShipmentRequiredAction — Actions required before fulfillment.
- `dropoff_due`: string (date-time) | null — Due date at seller-local midnight, serialized with timezone; not the overdue cutoff. Null for pickup, non-pre-transit shipments, or missing inputs.
- `replacement_shipment_id`: string | null — Immediate successor shipment ID after replacement, bundling, or splitting; not the final successor in a chain.
- `created_at`: string (date-time) | null — Creation timestamp, if recorded.
- `updated_at`: string (date-time) | null — Last update timestamp, if recorded.

### ShipmentDocuments
- `label_url`: string | null — Shipping label URL, if available. Usually hosted by the label provider, which sets how long it stays valid.
- `bundled_url`: string | null — Combined label and packing slip, or pickup slip URL. This presigned URL is valid for up to 1 hour; re-fetch the shipment with `GET /shipments/{shipment_id}` for a fresh link.
- `commercial_invoice_url`: string | null — Commercial invoice URL from the label provider, if one was issued.

### ShipmentInsurance
- `amount`: Money — Insured value.
- `contents`: string | null — Description of insured contents.

### ShipmentRequiredAction
enum: country_of_origin_required, itn_required, order_pending_cancellation, package_review_required

### ShipmentStatus
enum: created, label_generated, dropped_off, in_transit, delivered, failed, cancelled, cancelled_not_shipped, cancelled_not_shipped_with_dropoff, cancelled_tracking_stuck

### ShipmentTracking
- `carrier`: string | null — The carrier delivering this shipment.
- `service`: string | null — The carrier service used for this shipment.
- `tracking_code`: string | null — The carrier's tracking code for this shipment.
- `last_mile_tracking_code`: string | null — The tracking code used for the final leg of delivery.

### Show
- `id`: string — The show's ID.
- `title`: string — The show's title.
- `url`: string — The url of the show in the seller's dashboard.
- `description`: string | null — The show's description, if set.
- `status`: ShowStatus — The show's lifecycle status. A stopped show can resume; an ended show cannot.
- `visibility`: ShowVisibility — Whether the show is visible to everyone or only to invited viewers.
- `scheduled_start_at`: string (date-time) | null — When the show is scheduled to start. Not updated when the show goes live.
- `ended_at`: string (date-time) | null — When the show ended, if it has.
- `thumbnail`: Media | null — The show's thumbnail image, if set.
- `created_at`: string (date-time) — Creation timestamp.
- `updated_at`: string (date-time) — Last update timestamp.

### ShowStatus
enum: scheduled, live, stopped, ended, cancelled

### ShowVisibility
enum: public, private

### UserSummary
- `id`: string — The user's decimal ID.
- `username`: string — The user's username.
- `display_name`: string | null — The user's display name.

### Weight
- `value`: number — The weight amount.
- `unit`: WeightUnit — The weight unit.

### WeightUnit — The unit used to express weight.
enum: ounce, pound, gram, kilogram

### OrderCreatedWebhookBody
- `type`: string — The webhook topic.
- `timestamp`: string (date-time) — When the event happened, in ISO 8601. Stable across retries; the `webhook-timestamp` header is when each attempt was sent.
- `data`: Order — The event's data. Its shape depends on the topic.
- `version`: string — The payload version.
- `seller_id`: string — The ID of the seller the event belongs to.

### OrderUpdatedWebhookBody
- `type`: string — The webhook topic.
- `timestamp`: string (date-time) — When the event happened, in ISO 8601. Stable across retries; the `webhook-timestamp` header is when each attempt was sent.
- `data`: Order — The event's data. Its shape depends on the topic.
- `version`: string — The payload version.
- `seller_id`: string — The ID of the seller the event belongs to.

### ProductAddedToShowWebhookBody
- `type`: string — The webhook topic.
- `timestamp`: string (date-time) — When the event happened, in ISO 8601. Stable across retries; the `webhook-timestamp` header is when each attempt was sent.
- `data`: ProductShowData — The event's data. Its shape depends on the topic.
- `version`: string — The payload version.
- `seller_id`: string — The ID of the seller the event belongs to.

### ProductCreatedWebhookBody
- `type`: string — The webhook topic.
- `timestamp`: string (date-time) — When the event happened, in ISO 8601. Stable across retries; the `webhook-timestamp` header is when each attempt was sent.
- `data`: Product — The event's data. Its shape depends on the topic.
- `version`: string — The payload version.
- `seller_id`: string — The ID of the seller the event belongs to.

### ProductDeletedData
- `id`: string — The deleted product's ID.

### ProductDeletedWebhookBody
- `type`: string — The webhook topic.
- `timestamp`: string (date-time) — When the event happened, in ISO 8601. Stable across retries; the `webhook-timestamp` header is when each attempt was sent.
- `data`: ProductDeletedData — The event's data. Its shape depends on the topic.
- `version`: string — The payload version.
- `seller_id`: string — The ID of the seller the event belongs to.

### ProductRemovedFromShowWebhookBody
- `type`: string — The webhook topic.
- `timestamp`: string (date-time) — When the event happened, in ISO 8601. Stable across retries; the `webhook-timestamp` header is when each attempt was sent.
- `data`: ProductShowData — The event's data. Its shape depends on the topic.
- `version`: string — The payload version.
- `seller_id`: string — The ID of the seller the event belongs to.

### ProductShowData
- `product_id`: string — The product's ID.
- `show_id`: string — The show's ID.

### ProductUpdatedWebhookBody
- `type`: string — The webhook topic.
- `timestamp`: string (date-time) — When the event happened, in ISO 8601. Stable across retries; the `webhook-timestamp` header is when each attempt was sent.
- `data`: Product — The event's data. Its shape depends on the topic.
- `version`: string — The payload version.
- `seller_id`: string — The ID of the seller the event belongs to.

### ShipmentCancelledWebhookBody
- `type`: string — The webhook topic.
- `timestamp`: string (date-time) — When the event happened, in ISO 8601. Stable across retries; the `webhook-timestamp` header is when each attempt was sent.
- `data`: Shipment — The event's data. Its shape depends on the topic.
- `version`: string — The payload version.
- `seller_id`: string — The ID of the seller the event belongs to.

### ShipmentCreatedWebhookBody
- `type`: string — The webhook topic.
- `timestamp`: string (date-time) — When the event happened, in ISO 8601. Stable across retries; the `webhook-timestamp` header is when each attempt was sent.
- `data`: Shipment — The event's data. Its shape depends on the topic.
- `version`: string — The payload version.
- `seller_id`: string — The ID of the seller the event belongs to.

### ShipmentItemsAddedWebhookBody
- `type`: string — The webhook topic.
- `timestamp`: string (date-time) — When the event happened, in ISO 8601. Stable across retries; the `webhook-timestamp` header is when each attempt was sent.
- `data`: ShipmentItemsData — The event's data. Its shape depends on the topic.
- `version`: string — The payload version.
- `seller_id`: string — The ID of the seller the event belongs to.

### ShipmentItemsData
- `shipment_id`: string — The shipment's ID.
- `weight`: Weight | null — Package weight, if known and valid.
- `dimensions`: Dimensions | null — Package dimensions, if known and valid.
- `hazardous_material`: HazardousMaterial | null — The hazardous-material classification of the contents.
- `signature_required`: boolean — Whether delivery requires a signature.
- `insurance`: ShipmentInsurance | null — Shipping insurance, if present.
- `shipment_item_ids`: array of string — Every item on the shipment after the change, including the items that were already on it, not only the items that were added or removed.

### ShipmentItemsRemovedWebhookBody
- `type`: string — The webhook topic.
- `timestamp`: string (date-time) — When the event happened, in ISO 8601. Stable across retries; the `webhook-timestamp` header is when each attempt was sent.
- `data`: ShipmentItemsData — The event's data. Its shape depends on the topic.
- `version`: string — The payload version.
- `seller_id`: string — The ID of the seller the event belongs to.

### ShipmentLabelData
- `shipment_id`: string — The shipment's ID.
- `reason`: enum(generated, regenerated) — Whether this is the shipment's first label or a replacement. enum: ['generated', 'regenerated']
- `tracking`: ShipmentTracking — Carrier and tracking information for the label.
- `documents`: ShipmentDocuments | null — The shipping documents; requires read:customers.

### ShipmentLabelGeneratedWebhookBody
- `type`: string — The webhook topic.
- `timestamp`: string (date-time) — When the event happened, in ISO 8601. Stable across retries; the `webhook-timestamp` header is when each attempt was sent.
- `data`: ShipmentLabelData — The event's data. Its shape depends on the topic.
- `version`: string — The payload version.
- `seller_id`: string — The ID of the seller the event belongs to.

### ShipmentParcelData
- `shipment_id`: string — The shipment's ID.
- `weight`: Weight | null — Package weight, if known and valid.
- `dimensions`: Dimensions | null — Package dimensions, if known and valid.
- `hazardous_material`: HazardousMaterial | null — The hazardous-material classification of the contents.
- `signature_required`: boolean — Whether delivery requires a signature.
- `insurance`: ShipmentInsurance | null — Shipping insurance, if present.

### ShipmentParcelUpdatedWebhookBody
- `type`: string — The webhook topic.
- `timestamp`: string (date-time) — When the event happened, in ISO 8601. Stable across retries; the `webhook-timestamp` header is when each attempt was sent.
- `data`: ShipmentParcelData — The event's data. Its shape depends on the topic.
- `version`: string — The payload version.
- `seller_id`: string — The ID of the seller the event belongs to.

### ShipmentReplacedData
- `previous_shipment`: Shipment — The shipment that was replaced. It no longer has any items, and its replacement_shipment_id is the new shipment's ID. It is usually cancelled, but keeps its previous status when Whatnot support creates the new label.
- `replacement_shipment`: Shipment — The new shipment that now holds the previous shipment's items.

### ShipmentReplacedWebhookBody
- `type`: string — The webhook topic.
- `timestamp`: string (date-time) — When the event happened, in ISO 8601. Stable across retries; the `webhook-timestamp` header is when each attempt was sent.
- `data`: ShipmentReplacedData — The event's data. Its shape depends on the topic.
- `version`: string — The payload version.
- `seller_id`: string — The ID of the seller the event belongs to.

### ShipmentTrackingCodeAddedWebhookBody
- `type`: string — The webhook topic.
- `timestamp`: string (date-time) — When the event happened, in ISO 8601. Stable across retries; the `webhook-timestamp` header is when each attempt was sent.
- `data`: ShipmentTrackingData — The event's data. Its shape depends on the topic.
- `version`: string — The payload version.
- `seller_id`: string — The ID of the seller the event belongs to.

### ShipmentTrackingData
- `shipment_id`: string — The shipment's ID.
- `tracking`: ShipmentTracking — Carrier and tracking information.

### ShowCancelledWebhookBody
- `type`: string — The webhook topic.
- `timestamp`: string (date-time) — When the event happened, in ISO 8601. Stable across retries; the `webhook-timestamp` header is when each attempt was sent.
- `data`: ShowStatusChangeData — The event's data. Its shape depends on the topic.
- `version`: string — The payload version.
- `seller_id`: string — The ID of the seller the event belongs to.

### ShowCreatedWebhookBody
- `type`: string — The webhook topic.
- `timestamp`: string (date-time) — When the event happened, in ISO 8601. Stable across retries; the `webhook-timestamp` header is when each attempt was sent.
- `data`: Show — The event's data. Its shape depends on the topic.
- `version`: string — The payload version.
- `seller_id`: string — The ID of the seller the event belongs to.

### ShowEndedWebhookBody
- `type`: string — The webhook topic.
- `timestamp`: string (date-time) — When the event happened, in ISO 8601. Stable across retries; the `webhook-timestamp` header is when each attempt was sent.
- `data`: ShowStatusChangeData — The event's data. Its shape depends on the topic.
- `version`: string — The payload version.
- `seller_id`: string — The ID of the seller the event belongs to.

### ShowStartedWebhookBody
- `type`: string — The webhook topic.
- `timestamp`: string (date-time) — When the event happened, in ISO 8601. Stable across retries; the `webhook-timestamp` header is when each attempt was sent.
- `data`: ShowStatusChangeData — The event's data. Its shape depends on the topic.
- `version`: string — The payload version.
- `seller_id`: string — The ID of the seller the event belongs to.

### ShowStatusChangeData
- `show_id`: string — The show's ID.

### ShowUpdatedWebhookBody
- `type`: string — The webhook topic.
- `timestamp`: string (date-time) — When the event happened, in ISO 8601. Stable across retries; the `webhook-timestamp` header is when each attempt was sent.
- `data`: Show — The event's data. Its shape depends on the topic.
- `version`: string — The payload version.
- `seller_id`: string — The ID of the seller the event belongs to.


# Guides (verbatim markdown from developers.whatnot.com)


---
## getting-started/introduction

# Introduction to Seller API

The Whatnot Seller API is a REST API for managing your Whatnot store from your own systems: products, inventory, orders, shipments, shows, and analytics.

<scalar-callout type="info">

Looking for the old GraphQL docs? Go to [developers.old.whatnot.com](https://developers.old.whatnot.com/docs/getting-started/introduction).

</scalar-callout>

## What you can do

- **Products**: create and manage listings, including variants, pricing, and media.
- **Inventory**: set or adjust available quantity on variants, individually or in batches.
- **Merchandising**: control a product's sale format and which shows or profile shop it's published to.
- **Orders**: retrieve orders and their line items, and cancel orders that haven't shipped.
- **Shipments**: retrieve shipment details, generate shipping labels, and add tracking codes.
- **Shows**: retrieve your scheduled, live, and past shows, along with their analytics.
- **Users**: look up the seller behind the current token, and disconnect your app's access.

## Base URL

```plaintext
https://api.whatnot.com/seller-api/rest/v2
```

## Getting started

1. Get an API token. See [Authentication](/getting-started/authentication) for the Bearer token format.
2. Check [Rate limits](/getting-started/rate-limits) so your integration behaves well under load.
3. Try a request (see below).
4. Set up [Webhooks](/getting-started/webhooks) if you want to react to events instead of polling.
5. Explore every endpoint in the [API Reference](/api-reference), or connect an agent [via MCP](/getting-started/mcp).

### Trying out the API

Use the [API Reference](/api-reference) to explore every endpoint and try real requests against the API directly from your browser, using your own API token.

### Making requests

The Seller API follows standard REST conventions: resources are addressed by URL, and the HTTP method (`GET`, `POST`, `PATCH`, `DELETE`) determines the action. Request and response bodies are JSON.

Every request must include your API token in the `Authorization` header, and a `Content-Type` header on any request with a body:

```plaintext
Authorization: Bearer <Your Whatnot Seller API Key>
Content-Type: application/json
```

For example, listing your products is a `GET` request to `/products`:

```plaintext
GET /products
Authorization: Bearer <Your Whatnot Seller API Key>
```

See the [API Reference](/api-reference) for the full set of endpoints, request/response schemas, and error responses.

---
## getting-started/authentication

# Authentication

## How do I generate an API token?

Create a personal access token from the **Personal access tokens** tab of your [developer dashboard](https://www.whatnot.com/dashboard/developer?tab=tokens), then select **Generate new token**. Only the account owner can create and manage tokens.

When you generate a token, you choose:

* **Name**: required, and must be unique among your tokens.
* **Description**: optional, to remind you what the token is for.
* **Expiration**: 7, 30, 60, or 90 days, a custom date, or no expiration.
* **Permissions**: the scopes the token can use. Choosing write access to a resource includes read access. See [Available Scopes](#available-scopes) for what each one unlocks.

Copy your token as soon as it's generated. It's shown only once, and you can't view it again after you leave the page.

## How do I authorize API requests once I have my API token?

Include your API token in every request using the Bearer token format:

```plaintext
Authorization: Bearer <Your Whatnot Seller API Key>
```

Personal access tokens use the prefix `wn_pat_tk_`. Tokens issued to an app through OAuth use the prefix `wn_access_tk_`.

## How do I manage my tokens?

Select a token on the **Personal access tokens** tab to see when it was created, when it was last used, when it expires, and which permissions it has. From there you can:

* **Edit** its name, description, expiration, or permissions. Expired tokens can't be edited; regenerate them instead.
* **Regenerate** it, which creates a new token with the same name, description, and permissions and deletes the current one. Anything using the current token stops working immediately, and the new token is shown only once.
* **Delete** it. Anything using the token stops working immediately, and this can't be undone.

## My token was leaked or compromised! What should I do?

Open the token in your [developer dashboard](https://www.whatnot.com/dashboard/developer?tab=tokens) right away. **Regenerate** it to get a replacement with the same settings, or **Delete** it if you no longer need it. Either way, the compromised token stops working immediately.

## Available Scopes

Your API key is assigned scopes based on the features it needs. For example, a key used to display and update inventory might have `read:inventory` and `write:inventory`, while one used to fulfill orders off-platform might have `write:orders` and `read:customers`.

The list below is generated from the live API reference, showing exactly which endpoints and fields each scope unlocks.

Loading scopes from the API reference…

Couldn’t load scopes

Source:``

---
## getting-started/rate-limits

# Rate Limits

The Seller API enforces a rate limit per seller, per connected app: **10 requests per second**. This limit is subject to change without notice.

## Checking your usage

Every response counted against the limit, including a `429`, carries `RateLimit` headers ([IETF draft-polli-ratelimit-headers-02](https://www.ietf.org/archive/id/draft-polli-ratelimit-headers-02.html)) so you can see where you stand before you're rejected:

```plaintext
RateLimit-Limit: 10, 10;w=1
RateLimit-Remaining: 7
RateLimit-Reset: 1
```

- `RateLimit-Limit`: the policy in effect (the limit, and the limit again with its window in seconds, `w=1`).
- `RateLimit-Remaining`: an estimate of requests left in the current window. Treat it as a hint, not an exact count. Don't assume a positive value guarantees your next request will succeed.
- `RateLimit-Reset`: seconds until the window resets.

A request that isn't counted against the limit (a `401`, or one that never reaches the limiter) has none of these headers.

## What happens when you hit the limit

A request that exceeds the limit gets a `429 Too Many Requests` response with a `Retry-After` header telling you how many seconds to wait (the same instant as `RateLimit-Reset` above):

```plaintext
HTTP/1.1 429 Too Many Requests
Retry-After: 1
RateLimit-Limit: 10, 10;w=1
RateLimit-Remaining: 0
RateLimit-Reset: 1

{
  "type": "rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Rate limit exceeded"
}
```

See [Errors](/errors) for the full shape of this response.

## What to do about it

- **Respect `Retry-After`.** Wait at least that many seconds before retrying the same request.
- **Self-throttle using `RateLimit-Remaining`.** Slow down as it approaches zero instead of waiting to be rejected. That's the proactive alternative to reacting to a `429` after the fact.
- **Back off exponentially on repeated 429s.** If you're still being limited after waiting, double your wait time on each subsequent attempt (with jitter) rather than retrying on a fixed interval. That avoids synchronized retry storms across your own requests. For example: wait `Retry-After` seconds, then double that wait on each further `429` (1s, 2s, 4s, 8s, ...) up to some capped maximum, adding a small random jitter to each wait so retries from multiple clients don't line up. Most HTTP clients also have this built in; for example, [`urllib3.util.Retry`](https://urllib3.readthedocs.io/en/stable/reference/urllib3.util.html#urllib3.util.Retry) or [Tenacity](https://tenacity.readthedocs.io/) in Python.
- **Spread out large syncs.** If you're backfilling or syncing a large catalog, pace your requests under the limit instead of bursting.
- **Use batch endpoints where available**, so one rate-limited request does the work of several:
  - `POST /inventory/set` and `POST /inventory/adjust` each accept up to 10 variants per request.
  - `PATCH /products/{product_id}/variants` updates up to 10 variants per request.
- **Cache what doesn't change often**, such as product catalogs or dimension profiles, instead of re-fetching on every request.

## Limit scope

The limit is per seller and per connected app. One high-volume integration won't exhaust the limit for a different app connected to the same seller, and different sellers using your app don't share a limit with each other.

---
## getting-started/webhooks

# Webhooks

Webhooks notify your app when something happens in a seller's store (an order is placed, a shipping label is generated, a show goes live) instead of you polling the API for changes.

Whatnot webhooks follow the [Standard Webhooks](https://www.standardwebhooks.com) specification, so you can verify them with the open-source Standard Webhooks libraries.

## Setting up a subscription

Webhook subscriptions are configured per client app from your [developer dashboard](https://www.whatnot.com/dashboard/developer): register a URL and choose the topics you want delivered to it. There's no REST endpoint for managing subscriptions today.

Each topic requires a scope. Your app and the seller's installation must both hold it, or that seller's events aren't delivered to you.

## Available topics

Each topic has its own page in the [Webhooks reference](/webhooks) showing its headers and payload, laid out like an API route.

| Topic                                                                                                                           | Description                                                                                                                                                                                                                                                                               | Required scope       |
| ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| [`orders.created`](/webhooks/tag/orders/webhook/post/orders.created)                                                            | An order was placed, or for an offer, the seller accepted it.                                                                                                                                                                                                                             | `read:orders`        |
| [`orders.updated`](/webhooks/tag/orders/webhook/post/orders.updated)                                                            | An order's status changed after it was placed, for example when it was cancelled or completed.                                                                                                                                                                                            | `read:orders`        |
| [`shows.created`](/webhooks/tag/shows/webhook/post/shows.created)                                                               | A seller scheduled a show. Rehearsals aren't sent.                                                                                                                                                                                                                                        | `read:shows`         |
| [`shows.updated`](/webhooks/tag/shows/webhook/post/shows.updated)                                                               | A show changed, such as its title, start time or visibility. Every update is sent, even one that only changed `updated_at`.                                                                                                                                                               | `read:shows`         |
| [`shows.started`](/webhooks/tag/shows/webhook/post/shows.started)                                                               | A show went live, including when a stopped show resumed.                                                                                                                                                                                                                                  | `read:shows`         |
| [`shows.ended`](/webhooks/tag/shows/webhook/post/shows.ended)                                                                   | A show ended, including when Whatnot ended an abandoned show. It drops out of `GET /merchandising/products/{product_id}/shows` for its products, but no `merchandising.products.removed_from_show` is sent for them.                                                                      | `read:shows`         |
| [`shows.cancelled`](/webhooks/tag/shows/webhook/post/shows.cancelled)                                                           | A show was cancelled. It drops out of `GET /merchandising/products/{product_id}/shows` for its products, but no `merchandising.products.removed_from_show` is sent for them.                                                                                                              | `read:shows`         |
| [`merchandising.products.added_to_show`](/webhooks/tag/merchandising/webhook/post/merchandising.products.added-to-show)         | A product was added to a show.                                                                                                                                                                                                                                                            | `read:merchandising` |
| [`merchandising.products.removed_from_show`](/webhooks/tag/merchandising/webhook/post/merchandising.products.removed-from-show) | A product was removed from a show, including when its listing was deleted. It isn't sent when a show is cancelled or ends; `shows.cancelled` and `shows.ended` cover those.                                                                                                               | `read:merchandising` |
| [`shipments.created`](/webhooks/tag/shipments/webhook/post/shipments.created)                                                   | A shipment was created for an order.                                                                                                                                                                                                                                                      | `read:shipments`     |
| [`shipments.label_generated`](/webhooks/tag/shipments/webhook/post/shipments.label-generated)                                   | A shipping label was generated or regenerated for a shipment.                                                                                                                                                                                                                             | `read:shipments`     |
| [`shipments.tracking_code_added`](/webhooks/tag/shipments/webhook/post/shipments.tracking-code-added)                           | A shipment got a tracking code, from a purchased label, the seller's own label or a replacement.                                                                                                                                                                                          | `read:shipments`     |
| [`shipments.parcel_updated`](/webhooks/tag/shipments/webhook/post/shipments.parcel-updated)                                     | The seller edited a shipment's parcel weight or dimensions. Adding or removing items also changes the parcel; shipments.items.added and shipments.items.removed carry the new parcel, and this webhook isn't sent for those changes.                                                      | `read:shipments`     |
| [`shipments.items.added`](/webhooks/tag/shipments/webhook/post/shipments.items.added)                                           | Items joined a shipment, when orders were bundled at checkout or the seller bundled shipments. shipment\_item\_ids lists every item on the shipment after the change, not only the added ones. The body also carries the shipment's parcel, which changes with its items.                 | `read:shipments`     |
| [`shipments.items.removed`](/webhooks/tag/shipments/webhook/post/shipments.items.removed)                                       | Items left a shipment, when it was split or unbundled or the seller bundled its items into another shipment. shipment\_item\_ids lists the items still on the shipment after the change, not the removed ones. The body also carries the shipment's parcel, which changes with its items. | `read:shipments`     |
| [`shipments.cancelled`](/webhooks/tag/shipments/webhook/post/shipments.cancelled)                                               | A shipment was cancelled by Whatnot support.                                                                                                                                                                                                                                              | `read:shipments`     |
| [`shipments.replaced`](/webhooks/tag/shipments/webhook/post/shipments.replaced)                                                 | All of a shipment's items moved to a new shipment, for example when a new label was bought for it, the seller added tracking from their own label, or Whatnot support changed its label. The previous shipment is usually cancelled. The body has both shipments.                         | `read:shipments`     |
| [`products.created`](/webhooks/tag/products/webhook/post/products.created)                                                      | A product was created.                                                                                                                                                                                                                                                                    | `read:inventory`     |
| [`products.updated`](/webhooks/tag/products/webhook/post/products.updated)                                                      | A product changed, including its variants, inventory or prices. The payload doesn't say which fields changed.                                                                                                                                                                             | `read:inventory`     |
| [`products.deleted`](/webhooks/tag/products/webhook/post/products.deleted)                                                      | A product was deleted.                                                                                                                                                                                                                                                                    | `read:inventory`     |

Some payloads include customer data only if your app holds `read:customers`. Without it, those fields are `null`:

| Topic                              | Customer fields                                 |
| ---------------------------------- | ----------------------------------------------- |
| `orders.created`, `orders.updated` | `buyer`                                         |
| `shipments.created`                | `recipient`, `destination_address`, `documents` |
| `shipments.label_generated`        | `documents`                                     |

Destination addresses and shipping documents (labels print the buyer's address) also need customer-address access, which private apps have and public apps get once Whatnot approves them.

## Delivery format

Every delivery is an HTTPS `POST` with a JSON body.

### Headers

| Header              | Description                                                                                                                                                                                                             |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `webhook-id`        | Unique ID of the event. Retries of a delivery send the same ID, so use it to [deduplicate](#deduplicating-events).                                                                                                      |
| `webhook-timestamp` | When this delivery attempt was sent, as a Unix timestamp in seconds. Each retry sends a new timestamp. The Standard Webhooks specification requires this format, so it differs from the payload's ISO 8601 `timestamp`. |
| `webhook-signature` | Space-separated signatures, each `v1,` followed by a base64 HMAC-SHA256 of the delivery. See [Verifying signatures](#verifying-signatures).                                                                             |
| `Content-Type`      | Always `application/json`.                                                                                                                                                                                              |

```http
POST /webhooks/whatnot HTTP/1.1
Content-Type: application/json
webhook-id: 0b7e4f6c-3d1a-4a8e-9f2b-5c6d7e8f9a0b
webhook-timestamp: 1792512005
webhook-signature: v1,8m/VX9GLLqhNZJndMpPw7OTUKSDI4szDXAmIFY8ffBI=

{"type": "shows.started", "timestamp": "2026-10-20T16:00:00.123Z", "data": {"show_id": "9b2f6c1e-4d3a-4f8b-a1c2-3d4e5f6a7b8c"}, "version": "v2", "seller_id": "1234567"}
```

### Payload

Every topic wraps its data in the same envelope:

```json
{
  "type": "shows.started",
  "timestamp": "2026-10-20T16:00:00.123Z",
  "data": { ... },
  "version": "v2",
  "seller_id": "1234567"
}
```

| Field       | Description                                                                                                                                                                                                                    |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `type`      | The topic, such as `orders.created`. Use it to route the event.                                                                                                                                                                |
| `timestamp` | When the event happened, in ISO 8601 UTC with millisecond precision. Stable across retries, unlike the `webhook-timestamp` header.                                                                                             |
| `data`      | The event's data. Its shape depends on the topic; each topic's page in the [Webhooks reference](/webhooks) documents it. Most topics send the same object the REST API returns, such as an [order](/api-reference/tag/orders). |
| `version`   | The payload version, `v2`.                                                                                                                                                                                                     |
| `seller_id` | The ID of the seller the event belongs to. It's part of the signed body, so the signature also vouches for it.                                                                                                                 |

## Verifying signatures

Verify every delivery before you trust it. Each signature is an HMAC-SHA256, keyed with your app's webhook secret, over the string `{webhook-id}.{webhook-timestamp}.{body}`. Any [Standard Webhooks library](https://github.com/standard-webhooks/standard-webhooks/tree/main/libraries) can check it for you.

### 1. Remove the `wn_wh_` prefix from your secret

Standard Webhooks libraries expect only the base64 key that follows the prefix, so remove `wn_wh_` from the secret in your developer dashboard before passing it to one:

```plaintext
Secret:       wn_wh_AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyA=
Signing key:        AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyA=
```

Don't skip this step. The libraries strip only their own `whsec_` prefix, so they read `wn_wh_` as part of the key. Some, such as the Python and Ruby libraries, then decode a wrong key without raising an error, and every signature check fails with no hint that the secret is the problem.

### 2. Verify the delivery with a library

Pass the library the **raw request body** and the request headers. Use the bytes exactly as received: parsing and re-serializing the JSON can reorder keys or change whitespace, and the signature won't match.

```javascript Node.js
// npm install standardwebhooks
import { createServer } from "node:http";
import { Webhook } from "standardwebhooks";

const secret = process.env.WHATNOT_WEBHOOK_SECRET.replace(/^wn_wh_/, "");
const wh = new Webhook(secret);

createServer(async (req, res) => {
  if (req.method !== "POST" || req.url !== "/webhooks/whatnot") {
    res.writeHead(404).end();
    return;
  }

  // Read the body as the exact bytes Whatnot signed.
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks);

  let event;
  try {
    event = wh.verify(body, req.headers);
  } catch {
    res.writeHead(400).end();
    return;
  }
  res.writeHead(204).end();
  // Process event.type and event.data after responding.
}).listen(3000);
```

```python Python
# pip install standardwebhooks flask
import os

from flask import Flask, request
from standardwebhooks.webhooks import Webhook, WebhookVerificationError

wh = Webhook(os.environ["WHATNOT_WEBHOOK_SECRET"].removeprefix("wn_wh_"))
app = Flask(__name__)


@app.post("/webhooks/whatnot")
def whatnot_webhook():
    try:
        event = wh.verify(request.get_data(), dict(request.headers))
    except WebhookVerificationError:
        return "", 400
    # Queue event["type"] and event["data"] for processing, then respond.
    return "", 204
```

```go Go
// go get github.com/standard-webhooks/standard-webhooks/libraries
package main

import (
	"encoding/json"
	"io"
	"net/http"
	"os"
	"strings"

	standardwebhooks "github.com/standard-webhooks/standard-webhooks/libraries/go"
)

type Event struct {
	Type     string          `json:"type"`
	SellerID string          `json:"seller_id"`
	Data     json.RawMessage `json:"data"`
}

var wh *standardwebhooks.Webhook

func handle(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil || wh.Verify(body, r.Header) != nil {
		w.WriteHeader(http.StatusBadRequest)
		return
	}
	var event Event
	if err := json.Unmarshal(body, &event); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusNoContent)
	// Process event.Type and event.Data after responding.
}

func main() {
	secret := os.Getenv("WHATNOT_WEBHOOK_SECRET")
	key := strings.TrimPrefix(secret, "wn_wh_")
	var err error
	wh, err = standardwebhooks.NewWebhook(key)
	if err != nil {
		panic(err)
	}

	http.HandleFunc("POST /webhooks/whatnot", handle)
	http.ListenAndServe(":8080", nil)
}
```

```ruby Ruby
# gem install standardwebhooks
require "standardwebhooks"

class WhatnotWebhooksController < ApplicationController
  SECRET = ENV.fetch("WHATNOT_WEBHOOK_SECRET").delete_prefix("wn_wh_")
  WEBHOOK = StandardWebhooks::Webhook.new(SECRET)

  def create
    event = WEBHOOK.verify(request.raw_post, {
      "webhook-id" => request.headers["webhook-id"],
      "webhook-timestamp" => request.headers["webhook-timestamp"],
      "webhook-signature" => request.headers["webhook-signature"],
    })
    # Queue event["type"] and event["data"] for processing, then respond.
    head :no_content
  rescue StandardWebhooks::WebhookVerificationError
    head :bad_request
  end
end
```

```php PHP
<?php
// composer require standard-webhooks/standard-webhooks
require __DIR__ . '/vendor/autoload.php';

$secret = preg_replace('/^wn_wh_/', '', getenv('WHATNOT_WEBHOOK_SECRET'));
$wh = new \StandardWebhooks\Webhook($secret);

$payload = file_get_contents('php://input');
try {
    $event = $wh->verify($payload, [
        'webhook-id' => $_SERVER['HTTP_WEBHOOK_ID'] ?? null,
        'webhook-timestamp' => $_SERVER['HTTP_WEBHOOK_TIMESTAMP'] ?? null,
        'webhook-signature' => $_SERVER['HTTP_WEBHOOK_SIGNATURE'] ?? null,
    ]);
} catch (\StandardWebhooks\Exception\WebhookVerificationException $e) {
    http_response_code(400);
    exit;
}

http_response_code(204);
// Process $event['type'] and $event['data'] after responding.
```

```csharp C#
// dotnet add package StandardWebhooks
using System.Net;
using StandardWebhooks;

var secret = Environment.GetEnvironmentVariable("WHATNOT_WEBHOOK_SECRET")!;
var webhook = new Webhook(secret.Replace("wn_wh_", ""));
string[] signedHeaders = ["webhook-id", "webhook-timestamp", "webhook-signature"];

var app = WebApplication.Create(args);

app.MapPost("/webhooks/whatnot", async (HttpRequest request) =>
{
    using var reader = new StreamReader(request.Body);
    var payload = await reader.ReadToEndAsync();

    var headers = new WebHeaderCollection();
    foreach (var name in signedHeaders)
    {
        headers.Set(name, request.Headers[name]);
    }

    try
    {
        webhook.Verify(payload, headers);
    }
    catch (WebhookVerificationException)
    {
        return Results.BadRequest();
    }
    // Queue the payload for processing, then respond.
    return Results.NoContent();
});

app.Run();
```

Each library rejects a delivery whose signature doesn't match or whose `webhook-timestamp` is more than 5 minutes from your server's clock, and returns or throws accordingly. Respond with a `4xx` to a delivery that fails verification.

### Verifying without a library

If no library fits your stack, compute the signature yourself:

1. Build the signed content: `{webhook-id}.{webhook-timestamp}.{raw body}`.
2. Compute an HMAC-SHA256 of it, keyed with the base64-decoded key from step 1, and base64-encode the result.
3. Split `webhook-signature` on spaces. The delivery is valid if any entry is `v1,` followed by your signature. Compare in constant time.
4. Reject the delivery if `webhook-timestamp` is more than 5 minutes from your current time.

```python
import base64
import hashlib
import hmac
import time


def verify(
    raw_body: bytes, headers: dict[str, str], webhook_secret: str
) -> bool:
    key = base64.b64decode(webhook_secret.removeprefix("wn_wh_"))
    msg_id = headers["webhook-id"]
    timestamp = headers["webhook-timestamp"]
    if abs(time.time() - int(timestamp)) > 5 * 60:
        return False

    signed_content = f"{msg_id}.{timestamp}.".encode() + raw_body
    digest = hmac.digest(key, signed_content, hashlib.sha256)
    expected = base64.b64encode(digest).decode()
    for entry in headers["webhook-signature"].split(" "):
        version, _, signature = entry.partition(",")
        if version == "v1" and hmac.compare_digest(signature, expected):
            return True
    return False
```

The example delivery under [Headers](#headers) is signed with the secret `wn_wh_AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyA=`. Use it to test your verification, skipping the timestamp check since that delivery is in the past.

## Delivery guarantees

* **At least once, not exactly once.** A delivery can be retried after you've already processed it. For example, if your endpoint accepts the request but the response times out before it reaches us. Always deduplicate (see below) rather than assuming one delivery per event.

* **No ordering guarantee.** Events for the same resource can arrive out of order, especially across retries. Don't assume `orders.updated` always arrives after the `orders.created` for the same order. Use the payload's `timestamp` or the resource's own state to determine the current state, not arrival order.

* **Retries use exponential backoff** for up to 11 attempts over roughly 2.5 days, then the event is marked permanently failed and isn't retried further:

  | Attempt | Delay before this attempt |
  | ------- | ------------------------- |
  | 2       | \~31 seconds              |
  | 3       | \~1 minute                |
  | 4       | \~4.5 minutes             |
  | 5       | \~17.5 minutes            |
  | 6       | \~53 minutes              |
  | 7       | \~2.2 hours               |
  | 8       | \~4.7 hours               |
  | 9       | \~9.1 hours               |
  | 10      | \~16.4 hours              |
  | 11      | \~1.2 days                |

  Each attempt is signed again with a new `webhook-timestamp`, so a retry passes the 5-minute timestamp check even days later.

* **Only a `2xx` response counts as success.** Any other status, a timeout, or a connection failure is treated as a failure and queued for retry. Respond quickly (we time out at 5 seconds) and do your real processing asynchronously after responding, rather than making us wait on it.

* **A failing endpoint is slowed down, then unsubscribed.** If your endpoint doesn't respond to deliveries with a `2xx` in a timely fashion, we reduce the rate we deliver to it, in hopes your service comes back up. If it keeps failing, you'll receive an email warning you that this is happening. If the failures continue for a prolonged period, we remove the subscription and email you to say so; subscribe again from your [developer dashboard](https://www.whatnot.com/dashboard/developer) once your endpoint is healthy.

## Deduplicating events

Every delivery carries a `webhook-id` header that uniquely identifies the event, and retries send the same ID. Store it, and if you receive a `webhook-id` you've already processed, skip it rather than reprocessing. This is the correct way to get exactly-once _processing_ on top of an at-least-once delivery guarantee, and it also turns away a replayed delivery.

## Best practices

* **Return `2xx` immediately, then process.** Acknowledge the delivery first; do slow work (database writes, calling other services) in a background job afterward.
* **Verify the signature on every request** before acting on the payload. Don't rely on the URL being secret.
* **Deduplicate by `webhook-id`**, since retries are expected, not exceptional.
* **Don't assume delivery order.** Reconcile based on the payload's own state and timestamps.
* **Keep an endpoint for reconciliation.** Webhooks are a notification mechanism, not a guaranteed event log. If your endpoint is down past the retry window, you'll miss events. Periodically reconcile against the [API Reference](/api-reference) (for example, listing recent orders or shipments) to catch anything a webhook didn't deliver.
* **Handle unknown topics and fields gracefully.** New topics and payload fields may be added over time; ignore what you don't recognize rather than failing.

---
## getting-started/mcp

# Connect via MCP

The Whatnot Seller API has a hosted [MCP](https://modelcontextprotocol.io) server. Connect an MCP-compatible client to let it call the Seller API directly, using your own API token.

**Server URL:**

```plaintext
https://mcp.whatnot.com
```

<scalar-callout type="info">

When you connect, your client will prompt you to authenticate before it can make requests on your behalf.

</scalar-callout>

## Set up your client

<scalar-tabs default="Claude Code">

<scalar-tab title="Claude Code">

Run the following command to add the Whatnot Seller API MCP server to Claude Code:

```bash
claude mcp add --transport http --client-id bb1bf1ca-0452-4737-ad8f-81175f1601b8 --callback-port 8080 whatnot https://mcp.whatnot.com
```

After you add the server, authenticate with:

```bash
claude /mcp
```

</scalar-tab>

<scalar-tab title="Cursor">

Add the following configuration to `~/.cursor/mcp.json` (or `.cursor/mcp.json` in your project) to add the Whatnot Seller API MCP server:

```json
{
  "mcpServers": {
    "whatnot-seller-api": {
      "url": "https://mcp.whatnot.com",
      "auth": {
        "CLIENT_ID": "bb1bf1ca-0452-4737-ad8f-81175f1601b8"
      }
    }
  }
}
```

For more information, see [Cursor's MCP documentation](https://docs.cursor.com/context/model-context-protocol).

</scalar-tab>

<scalar-tab title="VS Code">

1. Open VS Code and open the Command Palette (`Cmd+Shift+P` on macOS, `Ctrl+Shift+P` on Windows/Linux).
2. Search for and select **MCP: Open User Configuration**.
3. Add this configuration to your user-level `mcp.json` file:

```json
{
  "servers": {
    "whatnot-seller-api": {
      "type": "http",
      "url": "https://mcp.whatnot.com",
      "oauth": {
        "clientId": "bb1bf1ca-0452-4737-ad8f-81175f1601b8"
      }
    }
  }
}
```

4. Save your configuration and restart VS Code.

See the [VS Code MCP documentation](https://code.visualstudio.com/docs/copilot/chat/mcp-servers) for more information.

</scalar-tab>

<scalar-tab title="Windsurf">

Add the following configuration to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "whatnot-seller-api": {
      "serverUrl": "https://mcp.whatnot.com",
      "oauthClientId": "bb1bf1ca-0452-4737-ad8f-81175f1601b8"
    }
  }
}
```

</scalar-tab>

<scalar-tab title="Claude Desktop">

1. Open **Settings → Connectors** in Claude Desktop.
2. Select **Add custom connector**.
3. Enter the server URL above.
4. Choose **Use your own OAuth client** and enter `bb1bf1ca-0452-4737-ad8f-81175f1601b8`. Leave the client secret blank.

</scalar-tab>

<scalar-tab title="Other">

MCP is an open protocol supported by many clients. Use the server URL above wherever your client asks for an MCP server address. If it asks for an OAuth client ID, use `bb1bf1ca-0452-4737-ad8f-81175f1601b8`.

</scalar-tab>

</scalar-tabs>

---
## request-ids

# Request IDs

Each API request has an associated request identifier, used to correlate logs across our infrastructure. Send your own value in the `X-Request-ID` request header to set it; otherwise we generate one for you.

When you contact us about a specific request, include the request identifier so we can find it quickly.

---
## reports

# Reports and Statements

[Generating a report](/api-reference/tag/reports-and-statements) returns a run whose `report_url` becomes a presigned CSV download link once the run completes. This page documents the columns of each report type's CSV, generated from the same schema the Seller API publishes alongside its OpenAPI description.

See [Reports and Statements](/api-reference/tag/reports-and-statements) for the `GET /reports`, `GET /reports/{report_id}`, and `POST /reports` operations that create and list these runs.

<!-- report-csv-schemas:start -->

<!-- Generated from api/whatnot-seller-api.json's x-artifact-schemas.seller-report-artifacts by scripts/report_csv_schemas.py. Don't edit by hand. -->

### Financial report

CSV column header: `seller_financial_report`.

| Column | Type | Description |
| --- | --- | --- |
| `transaction_completed_at_utc` | datetime | When this ledger transaction completed, in UTC. |
| `order_placed_at_utc` | datetime | When the order was placed, in UTC. Null for a transaction not tied to a specific order, such as a shipping charge, carrier adjustment, or tip. |
| `seller_id` | string | The ID of the seller this report is for. |
| `transaction_type` | string | The kind of ledger transaction: ORDER_EARNINGS, SHIPPING_CHARGE, CARRIER_ADJUSTMENT, CARRIER_ADJUSTMENT_REFUND, ORDER_REFUND, ORDER_REFUND_SHIPPING_COSTS, APPEALED_ORDER_REFUND, APPEALED_ORDER_REFUND_SHIPPING_COSTS, or TIP. |
| `transaction_message` | string | A human-readable note recorded on the ledger transaction. |
| `order_id` | string | The order this transaction is for. Null for a transaction not tied to a specific order, such as a carrier adjustment or tip. |
| `listing_title` | string | The title of the listing sold. Set only for ORDER_EARNINGS. |
| `listing_description` | string | The description of the listing sold. Set only for ORDER_EARNINGS. |
| `product_category` | string | The category of the product sold. Set only for ORDER_EARNINGS. |
| `buy_format` | string | How the item was sold, such as auction or buy it now. Set only for ORDER_EARNINGS. |
| `sale_type` | string | FLASH when the item was sold as part of a flash sale, otherwise null. Set only for ORDER_EARNINGS. |
| `quantity_sold` | integer | The quantity of the item sold. Set only for ORDER_EARNINGS. |
| `sku` | string | The SKU of the item sold. Set only for ORDER_EARNINGS. |
| `cost_of_goods` | number | The seller's recorded per-item cost for the item sold, in major currency units. Set only for ORDER_EARNINGS. |
| `livestream_id` | string | The show this transaction is associated with. Null for a transaction not tied to a show, such as a carrier adjustment or an order placed outside a show. |
| `livestream_title` | string | The title of the associated show. |
| `buyer_name` | string | The buyer's username. Set only for ORDER_EARNINGS and TIP transactions. |
| `buyer_state` | string | The buyer's shipping address state. Set only for ORDER_EARNINGS. |
| `buyer_country` | string | The buyer's shipping address country code. Set only for ORDER_EARNINGS. |
| `shipment_id` | string | The shipment this transaction is associated with. Null for a transaction not tied to a shipment, such as a tip. |
| `transaction_currency` | string | The currency transaction_amount and the fee columns are in. |
| `transaction_amount` | number | The signed amount of this ledger transaction, in major currency units. Negative for charges and refunds. |
| `buyer_paid` | number | The order's total amount charged to the buyer, in major currency units. Set only for ORDER_EARNINGS. |
| `original_item_price` | number | The item's price before any seller-generated coupon was applied, in major currency units. Set only for ORDER_EARNINGS. |
| `coupon_cost` | number | The seller-generated coupon amount applied to the order, in major currency units; negative when a coupon was applied. Set only for ORDER_EARNINGS. |
| `post_coupon_price` | number | The item's price after any seller-generated coupon was applied: original_item_price plus coupon_cost. Set only for ORDER_EARNINGS. |
| `seller_shipping_charge` | number | Shipping costs paid by the seller on this order, in major currency units. Set only for ORDER_EARNINGS. |
| `commission_fee` | number | Whatnot's commission on this order, in major currency units. Set only for ORDER_EARNINGS. |
| `commission_tax` | number | Tax charged on commission_fee, in major currency units. Set only for ORDER_EARNINGS. |
| `processing_fee` | number | Payment processing fee charged on this order, in major currency units. Set only for ORDER_EARNINGS. |
| `processing_fee_tax` | number | Tax charged on processing_fee, in major currency units. Set only for ORDER_EARNINGS. |
| `ledger_transaction_id` | string | The ID of the underlying ledger transaction. |

### Overview analytics report

CSV column header: `analytics_overview_report`.

| Column | Type | Description |
| --- | --- | --- |
| `date` | string | The calendar day this row covers, in ISO 8601. |
| `currency` | string | The currency the money fields in this row are denominated in. |
| `estimated_sales` | string, nullable | The sum of the final purchase prices of completed orders, after any seller-generated coupons have been applied. Does not include shipping costs, taxes, or non-order revenue like tips. |
| `in_show_estimated_sales` | string, nullable | Estimated sales from orders placed during a show. |
| `marketplace_estimated_sales` | string, nullable | Estimated sales from orders placed on the profile shop outside a show. |
| `estimated_earnings` | string, nullable | Estimated sales for completed orders minus fees and costs, such as commission, payment processing fees, and seller-paid shipping costs. |
| `in_show_estimated_earnings` | string, nullable | Estimated earnings from orders placed during a show. |
| `marketplace_estimated_earnings` | string, nullable | Estimated earnings from orders placed on the profile shop outside a show. |
| `orders_count` | integer, nullable | The number of unique transactions paid for by buyers. |
| `in_show_orders_count` | integer, nullable | The number of orders placed during a show. |
| `marketplace_orders_count` | integer, nullable | The number of orders placed on the profile shop outside a show. |
| `giveaway_orders_count` | integer, nullable | The number of giveaway orders. |
| `average_order_value` | string, nullable | The average final purchase price of each completed order, calculated by dividing estimated sales by orders. |
| `buyers_count` | integer, nullable | The number of unique buyers who completed a purchase. |
| `new_buyers_count` | integer, nullable | The number of unique buyers who bought from the seller for the first time. |
| `returning_buyers_count` | integer, nullable | The number of unique buyers who had bought from the seller before and bought again. |
| `follows_count` | integer, nullable | The number of people who followed the seller. |
| `referral_follows_count` | integer, nullable | The number of follows that came from a referral. |
| `non_referral_follows_count` | integer, nullable | The number of follows that did not come from a referral. |
| `livestreams_count` | integer, nullable | The number of shows the seller went live for. |
| `stream_minutes` | integer, nullable | The total duration of the seller's shows, in minutes. |
| `viewers_per_hour` | integer, nullable | The average number of unique viewers per hour. |
| `average_watch_time_seconds` | integer, nullable | The average length of time each viewer watched, in seconds. |

### Livestreams analytics report

CSV column header: `analytics_livestreams_report`.

| Column | Type | Description |
| --- | --- | --- |
| `livestream_id` | string | The ID of the show this row covers. |
| `livestream_title` | string | The title of the show. |
| `start_time` | datetime | When the show started. |
| `currency` | string, nullable | The currency the money fields in this row are denominated in. Null when the show has no sales, earnings, or giveaway spend. |
| `livestream_impression_count` | integer, nullable | Times the show's thumbnail appeared in the feed or in search before the show ended. |
| `livestream_clickthrough_rate` | number, nullable | The percentage of people who clicked into the show after seeing its thumbnail in the feed or search before the show ended. |
| `sales` | string, nullable | Total sales from orders in this show, excluding shipping, taxes, and tips. |
| `estimated_earnings` | string, nullable | Estimated sales minus fees and costs, such as Whatnot's commission, payment processing fees, and seller-paid shipping costs. |
| `orders_count` | integer, nullable | The number of unique transactions paid for by buyers during this show. |
| `average_order_value` | string, nullable | The average final purchase price of each completed order. |
| `giveaway_orders_count` | integer, nullable | The number of giveaway orders during this show. |
| `giveaway_spend` | string, nullable | Total shipping costs on giveaway orders from this show. |
| `buyers_count` | integer, nullable | The total number of unique buyers who bought from the seller during this show. |
| `first_time_buyers_count` | integer, nullable | The number of unique buyers who bought from the seller for the first time during this show. |
| `returning_buyers_count` | integer, nullable | The number of unique buyers who had bought from the seller before and bought again during this show. |
| `giveaway_winners_count` | integer, nullable | The number of unique buyers who won a giveaway during this show. |
| `first_time_giveaway_winners_count` | integer, nullable | The number of unique buyers who won a giveaway from the seller for the first time during this show. |
| `returning_giveaway_winners_count` | integer, nullable | The number of unique buyers who had won a giveaway from the seller before and won again during this show. |
| `buyer_shares_count` | integer, nullable | The number of times the show was shared by users. |
| `stream_minutes` | integer, nullable | The total duration of the show, in minutes. |
| `max_concurrent_viewers` | integer, nullable | The highest number of viewers watching the show at one given time. |
| `total_views` | integer, nullable | The total number of times viewers watched the show for 30 seconds or more. A viewer can count more than once if they leave and rejoin. |
| `distinct_viewers_count` | integer, nullable | The total number of unique viewers who watched the show for 30 seconds or more. |
| `average_rating` | number, nullable | The average rating buyers gave for orders from this show. |

### analytics_show_details_report

CSV column header: `analytics_show_details_report`.

| Column | Type | Description |
| --- | --- | --- |
| `show` | string, nullable | The show's title. |
| `start_time` | datetime, nullable | When the show started. |
| `duration_minutes` | integer, nullable | The show's length, in minutes. |
| `category` | string, nullable | The show's product category. |
| `thumbnail_impressions` | integer, nullable | How many times the show's thumbnail was shown in feeds. |
| `thumbnail_ctr` | number, nullable | Share of thumbnail impressions that were tapped, in percentage points. |
| `currency` | string, nullable | ISO currency code of the money fields in this row (estimated_sales, estimated_earnings, estimated_aov, sales_per_hour, giveaway_shipping_cost). |
| `estimated_sales` | string, nullable | Total sales from orders in this show, excluding shipping, taxes, and tips. |
| `estimated_sales_benchmark` | number, nullable | Change in estimated_sales against the seller's own trailing average, in percentage points. |
| `estimated_sales_benchmark_label` | string, nullable | What estimated_sales_benchmark is compared against. |
| `estimated_earnings` | string, nullable | Estimated sales minus fees and costs (commission, payment processing, seller-paid shipping). |
| `estimated_earnings_benchmark` | number, nullable | Change in estimated_earnings against the seller's own trailing average, in percentage points. |
| `estimated_earnings_benchmark_label` | string, nullable | What estimated_earnings_benchmark is compared against. |
| `estimated_orders` | integer, nullable | Estimated number of completed orders in this show, excluding cancellations. |
| `estimated_orders_benchmark` | number, nullable | Change in estimated_orders against the seller's own trailing average, in percentage points. |
| `estimated_orders_benchmark_label` | string, nullable | What estimated_orders_benchmark is compared against. |
| `estimated_aov` | string, nullable | Average order value for this show (estimated_sales divided by estimated_orders). |
| `estimated_aov_benchmark` | number, nullable | Change in estimated_aov against the seller's own trailing average, in percentage points. |
| `estimated_aov_benchmark_label` | string, nullable | What estimated_aov_benchmark is compared against. |
| `sales_per_hour` | string, nullable | estimated_sales divided by the show's duration in hours. |
| `sales_per_hour_benchmark` | number, nullable | Change in sales_per_hour against the seller's own trailing average, in percentage points. |
| `sales_per_hour_benchmark_label` | string, nullable | What sales_per_hour_benchmark is compared against. |
| `orders_per_hour` | integer, nullable | estimated_orders divided by the show's duration in hours. |
| `orders_per_hour_benchmark` | number, nullable | Change in orders_per_hour against the seller's own trailing average, in percentage points. |
| `orders_per_hour_benchmark_label` | string, nullable | What orders_per_hour_benchmark is compared against. |
| `total_giveaway_orders` | integer, nullable | Number of giveaway orders in this show. |
| `buyer_giveaway_orders` | integer, nullable | Number of buyer-appreciation giveaway orders in this show. |
| `giveaway_shipping_cost` | string, nullable | The seller's total shipping cost on giveaway orders in this show. |
| `giveaways_per_hour` | integer, nullable | total_giveaway_orders divided by the show's duration in hours. |
| `unique_giveaway_entries` | integer, nullable | Distinct people who entered any giveaway in this show, counted once each across giveaways. |
| `unique_giveaway_winners` | integer, nullable | Distinct giveaway winners in this show. |
| `new_followers_from_giveaways` | integer, nullable | New followers gained as a result of giveaways in this show. |
| `total_views` | integer, nullable | Total times viewers watched this show for more than 30 seconds; a viewer can count more than once if they leave and rejoin. |
| `max_concurrent_viewers` | integer, nullable | Highest number of viewers watching this show at the same time. |
| `viewers_per_hour` | integer, nullable | unique_viewers divided by the show's duration in hours. |
| `viewers_per_hour_benchmark` | number, nullable | Change in viewers_per_hour against the seller's own trailing average, in percentage points. |
| `viewers_per_hour_benchmark_label` | string, nullable | What viewers_per_hour_benchmark is compared against. |
| `avg_watch_time` | string, nullable | Average time each viewer spent watching this show, formatted as e.g. "5 min 24s". |
| `avg_watch_time_benchmark` | number, nullable | Change in average watch time against the seller's own trailing average, in percentage points. |
| `avg_watch_time_benchmark_label` | string, nullable | What avg_watch_time_benchmark is compared against. |
| `new_followers` | integer, nullable | Net new followers gained during this show. |
| `new_followers_benchmark` | number, nullable | Change in new_followers against the seller's own trailing average, in percentage points. |
| `new_followers_benchmark_label` | string, nullable | What new_followers_benchmark is compared against. |
| `show_shares` | integer, nullable | Number of times this show was shared by users. |
| `show_shares_benchmark` | number, nullable | Change in show_shares against the seller's own trailing average, in percentage points. |
| `show_shares_benchmark_label` | string, nullable | What show_shares_benchmark is compared against. |
| `unique_viewers` | integer, nullable | Distinct viewers who watched this show for more than 30 seconds. |
| `returning_viewers` | integer, nullable | Of unique_viewers, those who had watched this seller before. |
| `returning_viewers_percentage` | number, nullable | returning_viewers as a share of unique_viewers, in percentage points. |
| `new_viewers` | integer, nullable | Of unique_viewers, those watching this seller for the first time. |
| `new_viewers_percentage` | number, nullable | new_viewers as a share of unique_viewers, in percentage points. |
| `unique_buyers` | integer, nullable | Distinct buyers who purchased during this show. |
| `returning_buyers` | integer, nullable | Of unique_buyers, those who had bought from this seller before. |
| `returning_buyers_percentage` | number, nullable | returning_buyers as a share of unique_buyers, in percentage points. |
| `new_buyers` | integer, nullable | Of unique_buyers, those buying from this seller for the first time. |
| `new_buyers_percentage` | number, nullable | new_buyers as a share of unique_buyers, in percentage points. |

<!-- report-csv-schemas:end -->

---
## errors

# Errors

The Seller API uses conventional HTTP response codes to indicate the success or failure of an API request. In general:

* Codes in the `2xx` range indicate success.
* Codes in the `4xx` range indicate an error that failed given the information provided.
* Codes in the `5xx` range indicate an error with the Whatnot servers (these are rare).

Most error bodies follow [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457) ("Problem Details for HTTP APIs") and are served as `application/problem+json`. The exception is `422 Unprocessable Content`; see [Validation errors](#validation-errors) below.

## Attributes

* `type` (string) A slug identifying the problem type, such as `invalid-parameter` or `product-not-found`. Stable for a given kind of error; use it for programmatic branching rather than parsing `detail`.
* `title` (string) A short, human-readable summary of the problem type. The same for every occurrence of a given `type`.
* `status` (integer) The HTTP status code, repeated here so the body stands on its own.
* `detail` (string) A human-readable explanation specific to this occurrence of the problem.
* Additional fields may appear depending on `type`. For example, `invalid-parameter` adds `param`, naming the request field that failed validation, and `missing-scope` adds `required_scopes`.

## Handling errors

Branch on the HTTP status code first, then on `type` for anything in the `4xx`/`5xx` range. Don't parse `detail`; it's meant for humans and may change wording over time.

### Example error response

```json
{
  "type": "invalid-parameter",
  "title": "Invalid parameter",
  "status": 422,
  "detail": "Quantity must be greater than or equal to 0.",
  "param": "items.0.quantity"
}
```

## Validation errors

A `422` for a malformed request body or query parameters doesn't follow the `type`/`title`/`status`/`detail` shape above. Instead it's served as `application/json` with a `detail` array, one entry per failed field:

```json
{
  "detail": [
    {
      "loc": ["body", "items", 0, "quantity"],
      "msg": "Input should be greater than or equal to 0",
      "type": "greater_than_equal"
    }
  ]
}
```

* `loc` (array) The path to the failing field, as alternating keys and indices starting with `body`, `query`, or `path`.
* `msg` (string) A human-readable explanation of the failure.
* `type` (string) A machine-readable validation failure code, such as `greater_than_equal` or `missing`.

### Best practices

* Check the HTTP status code first, then branch on `type` for anything in the `4xx`/`5xx` range.
* Retry `429` and `5xx` responses with exponential backoff; don't retry other `4xx` errors without changing the request.
* For idempotent writes (such as setting or adjusting inventory), reuse the same per-item `idempotency_key` when retrying so it isn't applied twice.
* Log the request ID from failed responses. It's the fastest way for support to look up what happened.

### HTTP Status Code Summary

| Code     | Status                | Description                                                                      |
| -------- | --------------------- | -------------------------------------------------------------------------------- |
| 200      | OK                    | Everything worked as expected.                                                   |
| 204      | No Content            | The request succeeded and there's nothing to return.                             |
| 207      | Multi-Status          | A batch request was accepted; check each item's own status in the response body. |
| 400      | Bad Request           | The request was malformed.                                                       |
| 401      | Unauthorized          | No valid API token was provided.                                                 |
| 403      | Forbidden             | The token's scopes, or the seller's enrollment, doesn't permit this request.     |
| 404      | Not Found             | The requested resource doesn't exist.                                            |
| 405      | Method Not Allowed    | The HTTP method isn't supported on this path.                                    |
| 409      | Conflict              | The request conflicts with the resource's current state.                         |
| 422      | Unprocessable Content | The request's parameters failed validation.                                      |
| 429      | Too Many Requests     | Too many requests hit the API too quickly. Back off and retry.                   |
| 500, 503 | Server Errors         | Something went wrong on Whatnot's end (these are rare).                          |

### Problem Types

| Type                           | Description                                                                                              |
| ------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `invalid-parameter`            | A request parameter failed validation.                                                                   |
| `invalid-product`              | The product described in the request can't be created or updated as given.                               |
| `missing-scope`                | The token lacks every scope that would authorize this request.                                           |
| `product-not-found`            | No product exists with the given ID.                                                                     |
| `product-not-deletable`        | The product can't be deleted in its current state.                                                       |
| `seller-not-approved`          | The seller isn't approved to create or update products.                                                  |
| `merchandising-rejected`       | The requested merchandising change can't be applied to the product.                                      |
| `variant-not-found`            | No variant exists with the given ID.                                                                     |
| `variants-disabled`            | Variant reads or updates aren't enabled for this seller.                                                 |
| `inventory-writes-disabled`    | Inventory writes aren't enabled for this seller.                                                         |
| `variant-batch-rejected`       | A batch variant update had invalid variants and `allow_partial_updates` was false, so none were applied. |
| `shipment-not-found`           | No shipment exists with the given ID.                                                                    |
| `shipment-item-not-found`      | No shipment item exists with the given ID.                                                               |
| `label-generation-rejected`    | The shipment's state, settings, or seller setup prevents label generation.                               |
| `seller-verification-required` | The seller must complete verification before this action is allowed.                                     |
| `tracking-code-not-allowed`    | The seller can't supply their own tracking code for this shipment.                                       |
| `tracking-code-rejected`       | The order items can't be moved onto one shipment with the given tracking code.                           |
| `invalid-tracking-code`        | The supplied tracking code failed validation.                                                            |
| `dimension-profile-not-found`  | No dimension profile exists with the given ID.                                                           |
| `show-not-found`               | No show exists with the given ID.                                                                        |
| `order-not-found`              | No order exists with the given ID.                                                                       |
| `order-not-cancellable`        | The order can't be cancelled in its current state.                                                       |
| `order-item-not-found`         | No order item exists with the given ID.                                                                  |
| `disconnect-failed`            | Disconnecting the app's installation failed; try again.                                                  |
| `malformed-request`            | The request couldn't be parsed.                                                                          |
| `unauthenticated`              | No valid API token was provided.                                                                         |
| `endpoint-not-found`           | No route matches this path.                                                                              |
| `method-not-allowed`           | No route matches this path and method.                                                                   |
| `rate-limited`                 | Too many requests hit the API too quickly.                                                               |
| `service-unavailable`          | The service is temporarily unavailable.                                                                  |
| `internal-error`               | An unexpected failure occurred; the cause is logged on our end but not returned to callers.              |
| `about:blank`                  | An HTTP error with no Seller API-specific problem type.                                                  |

---
## taxonomy

# Taxonomy

Whatnot organizes every product in the marketplace under a single category tree: our **product taxonomy**. We publish the full, machine-readable taxonomy to a public GitHub repository so you can browse it, diff it, and build against it:

> **[github.com/Whatnot-Inc/product-taxonomy](https://github.com/Whatnot-Inc/product-taxonomy)**

The repository is generated automatically from Whatnot's internal source of truth. It is published, not hand-edited. The taxonomy is available in two equivalent formats under [`data/`](https://github.com/Whatnot-Inc/product-taxonomy/tree/main/data):

* [`data/taxonomy.json`](https://github.com/Whatnot-Inc/product-taxonomy/blob/main/data/taxonomy.json)
* [`data/taxonomy.yml`](https://github.com/Whatnot-Inc/product-taxonomy/blob/main/data/taxonomy.yml)

Each entry describes one category:

| Field              | Type           | Description                                                        |
| ------------------ | -------------- | ------------------------------------------------------------------ |
| `id`               | number         | Stable category identifier.                                        |
| `type`             | string         | Machine-readable category slug.                                    |
| `label`            | string         | Human-readable display name.                                       |
| `parent_id`        | number \| null | Parent category `id`; `null` for top-level categories.             |
| `allows_inventory` | boolean        | Whether the category accepts inventory (present where applicable). |

The top-level `version` field is the published [semantic version](https://semver.org) of the taxonomy. See the repository's `CHANGELOG.md` for the history of published versions.

## Explore the taxonomy

The explorer below fetches `data/taxonomy.json` **directly from GitHub on load**, so it always reflects the latest published taxonomy. Search across every assembled breadcrumb, drill down level by level, and select any category to inspect its breadcrumb and full details.

×

Loading taxonomy…

Couldn’t load the taxonomy

Source:``