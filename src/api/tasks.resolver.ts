import { Query, Resolver, ResolveField, Parent } from '@nestjs/graphql';
import { Ctx, Logger, Order, OrderService, RequestContext, UserInputError } from '@vendure/core';
import { SHOULD_CLEAR_KEY, TasksService } from './tasks.service';
import axios from 'axios';
import { loggerCtx } from '../constants';

@Resolver()
export class TasksResolver {
    constructor(private taskService: TasksService, 
        private orderService: OrderService) {}

    @Query()
    tasks(@Ctx() ctx: RequestContext) {
        return this.taskService.getTasks(ctx);
    }
    
    @ResolveField('deliveryRoute')
    @Resolver('Order')
    async deliveryRoute(@Ctx() ctx: RequestContext, @Parent() order: Order) {
        const API_KEY= process.env.googleapikey;
        if((order.customFields as any).deliveryRoute?.trim().length){
            Logger.info(`Returning cached delivery route for order ${order.code}`, loggerCtx)
            return (order.customFields as any).deliveryRoute
        }
        const destinationPlaceId:string= (order.customFields as any).google_place_id;
        const originPlaceId:string= (ctx.channel.customFields as any).google_place_id;
        if(!originPlaceId?.trim().length || !destinationPlaceId?.trim().length){
            return 
        }
        const originDetails= await axios.get(`https://maps.googleapis.com/maps/api/place/details/json?placeid=${originPlaceId}&key=${API_KEY}`)
        if(!originDetails.data.result?.name){
            throw new UserInputError(`Couldn't find store location details for Channel ${ctx.channel.code}`)
        }
        const destinationDetails= await axios.get(`https://maps.googleapis.com/maps/api/place/details/json?placeid=${destinationPlaceId}&key=${API_KEY}`)
        if(!destinationDetails.data.result?.name){
            throw new UserInputError(`Couldn't find shipping address details for Order ${order.code}`)
        }
        const url= encodeURI(`https://www.google.com/maps/dir/?api=1&origin=${originDetails.data.result.name}&origin_place_id=${originPlaceId}&destination=${destinationDetails.data.result.name}&destination_place_id=${destinationPlaceId}&travelmode=driving`);
        await this.orderService.updateCustomFields(ctx, order.id, {...order.customFields, deliveryRoute: url})
        Logger.info(`Returning calculated delivery route for order ${order.code}`, loggerCtx)
        return url;
    }

   
}