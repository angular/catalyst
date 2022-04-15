import {CommonModule} from '@angular/common';
import {NgModule} from '@angular/core';

import {ExampleComponent} from './example_component';


@NgModule({
  declarations: [
    ExampleComponent,
  ],
  imports: [
    CommonModule,
  ],
  exports: [
    ExampleComponent,
  ],
})
export class ExampleModule {
}
