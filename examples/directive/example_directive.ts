import {Directive, ElementRef, Input, OnChanges} from '@angular/core';

/**
 * Replaces span textContent with text provided in content input.
 *
 * Also contains property with value of textContent capitalized.
 */
@Directive({
  selector: 'span[replaceContent]',
})
export class ExampleDirective implements OnChanges {
  @Input() content = '';

  contentCapitalized = '';

  constructor(private readonly elementRef: ElementRef<HTMLSpanElement>) {}

  ngOnChanges() {
    this.elementRef.nativeElement.textContent = this.content;
    this.contentCapitalized = this.content.toUpperCase();
  }
}
