import { SharedModule } from '@vendure/admin-ui/core';
import { Component } from '@angular/core';

@Component({
    selector: 'greeter',
    template: `
        <vdr-page-block>
            <task-list/>
            <delivery-route/>
        </vdr-page-block>
    `,
})
export class GreeterComponent {
    
}