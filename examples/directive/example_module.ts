import {CommonModule} from '@angular/common';
import {NgModule} from '@angular/core';

import {ExampleDirective} from './example_directive';


@NgModule({
  declarations: [
    ExampleDirective,
  ],
  imports: [
    CommonModule,
  ],
  exports: [
    ExampleDirective,
  ],
})
export class ExampleModule {
}
