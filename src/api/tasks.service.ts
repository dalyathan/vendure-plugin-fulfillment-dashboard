import {Injectable, OnModuleInit} from '@nestjs/common';
import { EventBus, Logger, Order, OrderEvent, OrderService, ChannelEvent, RequestContext, TransactionalConnection } from '@vendure/core';
import {LessThanOrEqual, Not, In, Between, FindOperator} from 'typeorm';
import dayjs from 'dayjs';
import { TaskMessage } from '../types';
import {filter} from 'rxjs';
import { loggerCtx } from '../constants';

export const SHOULD_CLEAR_KEY="shouldClearCachedDeliveryRoute"
@Injectable()
export class TasksService implements OnModuleInit{
    constructor(private conn: TransactionalConnection,
        private eventBus: EventBus, private orderService: OrderService){

    }
    onModuleInit() {
        this.eventBus.ofType(OrderEvent).pipe(filter((event)=> event.type === 'updated')).subscribe(async ({ctx, order})=>{
            const customFields=order.customFields as any;
            if(customFields.deliveryRoute?.trim().length && !customFields.google_place_id?.trim().length){
                await this.orderService.updateCustomFields(ctx, order.id, {...customFields, deliveryRoute: ''})
                Logger.info(`Cleared cached delivery route for order ${order.code}`, loggerCtx)
            }
        })
        this.eventBus.ofType(ChannelEvent).pipe(filter((event)=> event.type === 'updated')).subscribe(async ({ctx, entity})=>{
            //we need to reset all the customFields.deliveryRoute of all the orders in this channel
            const orderRepo=this.conn.getRepository(ctx, Order);
            const channelOrders= await orderRepo.createQueryBuilder('order')
                .select('order.id')
                .addSelect('order.customFields.deliveryRoute')
            .leftJoinAndSelect('order.lines','line')
            .setFindOptions({where:{
                channels:{
                    id: ctx.channelId
                }
            }})
            .getMany()
            for(let order of channelOrders){
                (order.customFields as any).deliveryRoute=''
            }
            await orderRepo.save(channelOrders);
            Logger.info(`Cleared cached delivery route for all orders in channel ${entity.code}`, loggerCtx)
        })
    }

    async getTasks(ctx: RequestContext):Promise<TaskMessage[]>{
        return [
            //high priority tasks first
            ...await this.getNotDeliveredOrder(ctx),
            ...await this.getNotPreparedWhenDeliveryDateIsToday(ctx),

            //then medium priority tasks
            ...await this.getNotCollectedOrders(ctx),
            ...await this.getPreparedAndNotOutForDeliveryWhenDeliveryDateIsToday(ctx),

            //then low priority tasks
            ...await this.getNotPreparedWhenDeliveryDateIsTommorrow(ctx),

            //others
            ...await this.getAnyOutForDeliveryWhenDeliveryDateIsToday(ctx)
        ]
    }

    async getNotCollectedOrders(ctx: RequestContext):Promise<TaskMessage[]>{
        const orders= await this.getFilteredOrders(ctx, LessThanOrEqual(dayjs(new Date).subtract(2, 'days').toDate()), 'readyforcollection')
       
        return orders.map((order)=>{
            return {
                taskName: `Refund Order ${this.getLink(order)} with code "no collection" and place items back on shelf`,
	            tag: 'Medium Priority',
                orderId: order.id,
                state: order.state,
                code: order.code,
                colorType: 'success'
            }
        })
    }

    async getNotDeliveredOrder(ctx: RequestContext):Promise<TaskMessage[]>{
        const orders= await this.getFilteredOrders(ctx, LessThanOrEqual(dayjs(new Date).subtract(1, 'days').toDate()), Not('Delivered'))
        
        return orders.map((order)=>{
            return {
                taskName: `${this.getLink(order)} passed delivery date, Reshedule Order`,
	            tag: 'High Priority',
                orderId: order.id,
                state: order.state,
                code: order.code,
                colorType: 'error'
            }
        })
    }

    async getNotPreparedWhenDeliveryDateIsToday(ctx: RequestContext):Promise<TaskMessage[]>{
        const todayStartOfDay= dayjs().startOf('day').toDate();
        const todayEndOfDay= dayjs().endOf('day').toDate()
        const orders= await this.getFilteredOrders(ctx, Between(todayStartOfDay, todayEndOfDay), In(['Draft','AddingItems','ArrangingPayment','PaymentAuthorized','PaymentSettled','awaitingprep','preparing']))
        
        return orders.map((order)=>{
            return {
                taskName: `Prepare ${this.getLink(order)}`,
	            tag: 'High Priority',
                orderId: order.id,
                state: order.state,
                code: order.code,
                colorType: 'error'
            }
        })
    }

    async getNotPreparedWhenDeliveryDateIsTommorrow(ctx: RequestContext):Promise<TaskMessage[]>{
        const tomorrow= dayjs().add(1, 'day');
        const tommorowStartOfDay= tomorrow.startOf('day').toDate();
        const tomorrowEndOfDay= tomorrow.endOf('day').toDate()
        const orders= await this.getFilteredOrders(ctx, Between(tommorowStartOfDay, tomorrowEndOfDay), In(['Draft','AddingItems','ArrangingPayment','PaymentAuthorized','PaymentSettled','awaitingprep','preparing']) )
        
        return orders.map((order)=>{
            return {
                taskName: `Prepare ${this.getLink(order)} for tommorow`,
	            tag: 'Low Priority',
                orderId: order.id,
                state: order.state,
                code: order.code,
                colorType: 'success'
            }
        })
    }

    async getPreparedAndNotOutForDeliveryWhenDeliveryDateIsToday(ctx: RequestContext):Promise<TaskMessage[]>{
        const todayStartOfDay= dayjs().startOf('day').toDate()
        const todayEndOfDay= dayjs().endOf('day').toDate()
        const orders= await this.getFilteredOrders(ctx, Between(todayStartOfDay, todayEndOfDay), 'readyfordelivery' )
        return orders.map((order)=>{
            return {
                taskName: `Send ${this.getLink(order)} out for delivery`,
	            tag: 'Medium Priority',
                orderId: order.id,
                state: order.state,
                code: order.code,
                colorType: 'success'
            }
        })
    }

    async getAnyOutForDeliveryWhenDeliveryDateIsToday(ctx: RequestContext):Promise<TaskMessage[]>{
        const todayStartOfDay= dayjs().startOf('day').toDate()
        const todayEndOfDay= dayjs().endOf('day').toDate()
        const orders= await this.getFilteredOrders(ctx, Between(todayStartOfDay, todayEndOfDay), 'outfordelivery' )
        
        return orders.map((order)=>{
            return {
                taskName: `Send ${this.getLink(order)} out for delivery`,
	            tag: 'In Progress',
                orderId: order.id,
                state: order.state,
                code: order.code,
                colorType: 'warning'
            }
        })
    }

    private async getFilteredOrders(ctx: RequestContext, dateFilter: FindOperator<Date>, stateFilter: FindOperator<String> | string){
        return await this.conn.getRepository(ctx, Order).
        createQueryBuilder('order')
          .select('order.code')
          .addSelect('order.id')
          .addSelect('order.state')
        .leftJoin('order.channels', 'orderChannel')
        .setFindOptions({where:{
            customFields:{
                Delivery_Collection_Date:  dateFilter
            },
            state: stateFilter as any,
            channels:{
                id: ctx.channelId
            }
        }})
        .getMany()
    }

    private getLink(order: Order){
        const link= order.state === 'Draft' ? `/admin/orders/draft/${order.id}` : `/admin/orders/${order.id}`
        return `<a class="button-ghost" href="${link}" ng-reflect-router-link="./orders,${order.id}" _ngcontent-ng-c518184086>
                    <span>${order.code}</span>
                    <clr-icon shape="arrow right" role="none">
                        <svg version="1.1" viewBox="0 0 36 36" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" focusable="false" role="img">
                            <path d="M27.66,15.61,18,6,8.34,15.61A1,1,0,1,0,9.75,17L17,9.81V28.94a1,1,0,1,0,2,0V9.81L26.25,17a1,1,0,0,0,1.41-1.42Z" class="clr-i-outline clr-i-outline-path-1">
                            </path>
                        </svg>
                    </clr-icon>
                </a>
                `
    }
}