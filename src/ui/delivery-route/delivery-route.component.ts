import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
    DataService,
    GetLatestOrdersQuery,
    ItemOf,
    SortOrder,
} from '@vendure/admin-ui/core';
import { gql } from 'apollo-angular';
import { BehaviorSubject, Observable, distinctUntilChanged, map, shareReplay, mergeMap, combineLatest } from 'rxjs';
import dayjs from 'dayjs';
type Timeframe = 'day' | 'week' | 'month';
function getOrdinal(day:number) {
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) {
        case 1:  return "st";
        case 2:  return "nd";
        case 3:  return "rd";
        default: return "th";
    }
}


declare var window: Window;

const GET_LATEST_ORDERS = gql`
    query GetLatestOrders($options: OrderListOptions) {
        orders(options: $options) {
            items {
                id
                type
                orderPlacedAt
                code
                state
                total
                totalWithTax
                currencyCode
                deliveryRoute
                customer {
                    id
                    firstName
                    lastName
                }
                customFields{
                    google_place_id
                    Delivery_Collection_Date
                }
                channels{
                    id
                    customFields{
                        google_place_id
                    }
                }
            }
        }
    }
`;

@Component({
    selector: 'delivery-route',
    templateUrl: './delivery-route.component.html',
    styleUrls: ['./delivery-route.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeliveryRouteComponent {
    today = new Date();
    yesterday = new Date(new Date().setDate(this.today.getDate() - 1));
    todayPlus1= new Date(new Date().setDate(this.today.getDate() +1));
    todayPlus2= new Date(new Date().setDate(this.today.getDate() +2));
    todayPlus3= new Date(new Date().setDate(this.today.getDate() +3));
    todayPlus4= new Date(new Date().setDate(this.today.getDate() +4));
    todayPlus5= new Date(new Date().setDate(this.today.getDate() +5));
    latestOrders$: Observable<Array<ItemOf<GetLatestOrdersQuery, 'orders'>>>;
    dateSelection$ = new BehaviorSubject<{ timeframe: Timeframe; date?: Date }>({
        timeframe: 'day',
        date: this.today,
    });
    deliveryTypeSelection$ = new BehaviorSubject<boolean>(true);
    dateRange$: Observable<{ start: Date; end: Date }>;
    constructor(private dataService: DataService) {
        const customParseFormat = require('dayjs/plugin/customParseFormat');
        dayjs.extend(customParseFormat);
        this.dateRange$ = this.dateSelection$.pipe(
            distinctUntilChanged(),
            map(selection => ({
                start: dayjs(selection.date).startOf(selection.timeframe).toDate(),
                end: dayjs(selection.date).endOf(selection.timeframe).toDate(),
            })),
            shareReplay(1),
        );
        this.latestOrders$ = combineLatest([this.dateRange$, this.deliveryTypeSelection$.pipe()]).pipe(
            mergeMap(([dateRange, isDelivery]) => {
            console.log(dateRange, isDelivery)
            return this.dataService
                .query(GET_LATEST_ORDERS, {
                    options: {
                        take: 10,
                        filter: {
                            // active: { eq: false },
                            Delivery_Collection_Date:{
                                between:{
                                    start: dateRange.start.toISOString(), 
                                    end: dateRange.end.toISOString()
                                }
                            },
                            // state: { notIn: ['Cancelled', 'Draft'] },
                            Is_Delivery: { eq:isDelivery},
                            // google_place_id:{
                            //     isNull: false, 
                            //     notEq: ""

                            // }
                        },
                        sort: {
                            orderPlacedAt: SortOrder.DESC,
                        },
                    },
                })
                .refetchOnChannelChange()
                .mapStream((data: any) => data.orders.items);
            }))
    }

    async openDeliveryRoute(deliveryRoute: string){
        (window as any).open(deliveryRoute);
    }

    format(date: Date){
        return dayjs(date).format("D")+ getOrdinal(dayjs(date).date())
    }
}