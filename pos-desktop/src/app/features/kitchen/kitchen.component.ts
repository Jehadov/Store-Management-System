// features/kitchen/kitchen.component.ts - outline
// Poll GET /orders?status=pending every 10s (or WebSocket in v2)
// Actions: PATCH /orders/:id/status {pending->preparing->ready->completed}
// Shows: order_number, tableNumber/serviceMethod, items + addons_snapshot, total, age
export const KitchenStatuses = ['pending', 'preparing', 'ready', 'completed'] as const;
