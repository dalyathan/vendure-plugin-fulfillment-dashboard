import { registerDashboardWidget } from '@vendure/admin-ui/core';

export default [
    registerDashboardWidget('fulfillment', {
        title: 'Fulfillment',
        supportedWidths: [4, 6, 8, 12],
        loadComponent: () =>
            import('./fulfillment-list/fulfillment-list.component').then(
                m => m.FulfillmentListComponent,
            ),
    }),
    registerDashboardWidget('delivery-route', {
        title: 'Delivery Route',
        supportedWidths: [4, 6, 8, 12],
        loadComponent: () =>
            import('./delivery-route/delivery-route.component').then(
                m => m.DeliveryRouteComponent,
            ),
    }),
];