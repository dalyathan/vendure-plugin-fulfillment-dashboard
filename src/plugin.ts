import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { AdminUiExtension } from '@vendure/ui-devkit/compiler';
import path from 'path';
import { TasksResolver } from './api/tasks.resolver';
import { adminApi } from './api/api';
import { TasksService } from './api/tasks.service';
import { tasksAndOrders } from './constants';

@VendurePlugin({
    imports: [PluginCommonModule],
    providers: [TasksService],
    configuration:(config)=>{
        config.customFields.Order.push({name: "deliveryRoute", type: 'string', internal: true},)
        config.authOptions.customPermissions.push(tasksAndOrders);
        return config;
    },
    adminApiExtensions:{
        resolvers: [TasksResolver],
        schema: adminApi
    },
    
})
export class VendureFulfillmentsDashboardPlugin {
    static ui: AdminUiExtension = {
        extensionPath: path.join(__dirname, 'ui'),
        ngModules: [
            {
              type: "shared" as const,
              ngModuleFileName: "shared.module.ts",
              ngModuleName: "SharedFulfillmentsModule",
            },
        ],
        routes: [{route: 'fulfillments', filePath: 'routes.ts'}],
        providers:['providers.ts']
      };
}