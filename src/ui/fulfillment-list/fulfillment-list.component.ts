import { Component } from '@angular/core';
import {DomSanitizer} from '@angular/platform-browser'
import { DataService, SharedModule } from '@vendure/admin-ui/core';
import { Observable } from 'rxjs';
import { TaskMessage } from '../types';
import { getTasks } from './fulfillment-list.graphql';


@Component({
    selector: 'reviews-widget',
    template: `
       <table>
        <tbody>
                <tr *ngFor="let task of tasks$ | async">
                    <td [innerHTML]="sanitizer.bypassSecurityTrustHtml(task.taskName)">
                        
                    </td>
                    <td class="chip-class">
                        <vdr-chip [colorType]="task.colorType">
                            {{task.tag}}
                        </vdr-chip>
                    </td>
                   
                </tr>
        </tbody>
       </table>
    `,
    standalone: true,
    styleUrl: './fulfillment-list.component.scss',
    imports: [SharedModule],
})
export class FulfillmentListComponent {
    tasks$: Observable<TaskMessage[]>;
    constructor(private dataService: DataService, private sanitizer: DomSanitizer) {
        this.tasks$ = this.dataService.query(getTasks)
        .mapStream((data: any) => data.tasks);
    }
}