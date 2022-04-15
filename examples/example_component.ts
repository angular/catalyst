import {Component, EventEmitter, Inject, InjectionToken, Input, OnChanges, OnInit, Output, SimpleChanges} from '@angular/core';
import {Observable} from 'rxjs';

export const INJECTED_MESSAGE = new InjectionToken<string>('INJECTED_MESSAGE');
export const AN_OBSERVABLE =
    new InjectionToken<Observable<string>>('AN_OBSERVABLE');

/** Example Component */
@Component({
  selector: 'example-component',
  templateUrl: './example_component.ng.html',
})
export class ExampleComponent implements OnChanges {
  @Input() anInput = 'Hello world!';
  @Output() anOutput = new EventEmitter<boolean>();

  computedValue!: string;

  constructor(
      @Inject(INJECTED_MESSAGE) readonly injectedMessage: string,
      @Inject(AN_OBSERVABLE) readonly anObservable: Observable<string>,
  ) {}

  ngOnChanges() {
    this.computedValue = `::${this.anInput}::`;
  }
}
