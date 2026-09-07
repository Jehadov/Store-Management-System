// features/pos/pos.component.ts - outline for Angular standalone component
// TODO: ng generate @angular/material scaffolding, then paste this logic
//
// State: categories[], products[], cart: PosCartItem[], tableNumber, serviceMethod
// Flow mirrors React: CategoryLine -> ProductCard grid -> Cart -> CheckoutStepper
// Differences for POS: big touch buttons, table selector (T1..T20), cash/cliq tendered,
// print receipt locally, enqueueOfflineOrder() on network fail, flushOfflineQueue() on interval.
export const PosFlow = ['categories', 'products', 'cart', 'payment', 'done'] as const;
