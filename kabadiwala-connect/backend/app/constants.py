# Category codes follow the MH26-28 brief (circuit boards, cables, batteries, screens, motors, mixed plastics)
CATEGORY_LABELS = {
    "paper": "Paper",
    "cardboard": "Cardboard",
    "plastic": "Plastic",
    "mixed_plastics": "Mixed plastics",
    "iron": "Iron",
    "aluminium": "Aluminium",
    "copper": "Copper",
    "glass": "Glass",
    "circuit_boards": "Circuit boards",
    "cables": "Cables",
    "batteries": "Batteries",
    "screens": "Screens",
    "motors": "Motors",
    "other": "Other recyclables",
}

REQUEST_STATUS_LABELS = {
    "open": "Open for offers",
    "scheduled": "Pickup scheduled",
    "arriving": "Collector arriving",
    "collected": "Material collected",
    "completed": "Completed",
    "cancelled": "Cancelled",
}
ACTIVE_REQUEST_STATUSES = ("open", "scheduled", "arriving", "collected")

LOT_STATUS_LABELS = {
    "available": "Available to buy",
    "purchased": "Purchased by dealer",
    "dispatched": "Dispatched to recycling unit",
    "received": "Received by recycling unit",
    "processing": "Recycling in progress",
    "recycled": "Recycled (confirmed by recycler)",
    "rejected": "Rejected at inspection",
}

STAGE_LABELS = {
    "request_submitted": "Request submitted",
    "request_cancelled": "Request cancelled",
    "offer_submitted": "Price offer submitted",
    "offer_accepted": "Offer accepted",
    "pickup_scheduled": "Pickup scheduled",
    "collector_arriving": "Collector arriving",
    "material_collected": "Material collected",
    "transaction_completed": "Transaction completed",
    "dealer_purchased": "Dealer purchase recorded",
    "dispatched_to_recycler": "Dispatched to recycling unit",
    "recycler_received": "Received by recycling unit",
    "inspection_failed": "Failed recycler inspection",
    "recycling_processing": "Recycling in progress",
    "recycled": "Recycling confirmed by recycler",
}
