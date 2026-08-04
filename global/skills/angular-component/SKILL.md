---
name: angular-component
description: >
  ALWAYS use when creating or refactoring an Angular component, service, or template.
  Covers Angular 18 conventions used across the Xomware frontends (Xomify, Xomper,
  Xomcloud, xomware.com): standalone components, signals, the new control flow, typed
  reactive forms, and OnPush change detection.
  Trigger phrases: "angular", "component", "standalone", "signal", "computed",
  "ngOnInit", "reactive form", "FormGroup", "service", "inject", "@if", "@for",
  "OnPush", "RxJS", "observable", "directive", "pipe".
---

# Angular Component — Xomware

Angular 18.2 across all Xomware frontends. Standalone everywhere — there are no NgModules
in new code.

## Component Template

```ts
// track-card.component.ts
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

import { Track } from '../../models/track.model';

@Component({
  selector: 'xom-track-card',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './track-card.component.html',
  styleUrl: './track-card.component.scss',
})
export class TrackCardComponent {
  readonly track = input.required<Track>();
  readonly compact = input(false);

  readonly played = output<string>();

  readonly subtitle = computed(() => {
    const t = this.track();
    return `${t.artist} · ${t.album}`;
  });

  onPlay(): void {
    this.played.emit(this.track().id);
  }
}
```

```html
<!-- track-card.component.html -->
@if (track(); as t) {
  <button type="button" class="track-card" (click)="onPlay()">
    <img [src]="t.artworkUrl" [alt]="t.title" />
    <span class="track-card__title">{{ t.title }}</span>
    <span class="track-card__subtitle">{{ subtitle() }}</span>
  </button>
} @else {
  <p>No track selected.</p>
}
```

## Rules

- `standalone: true` on every component, directive, and pipe. No NgModules.
- `ChangeDetectionStrategy.OnPush` always — never the default.
- `input()` / `input.required()` / `output()` functions, not `@Input()` / `@Output()`
  decorators. Mark them `readonly`.
- Signals for component state. Reach for `BehaviorSubject` only when you genuinely need
  the Rx operator pipeline; otherwise `signal()` + `computed()`.
- `inject()` over constructor parameter injection.
- New control flow (`@if`, `@for`, `@switch`, `@defer`) — not `*ngIf` / `*ngFor`.
  `@for` requires `track`.
- Selector prefix `xom-`.
- One component per file. File name kebab-case matching the class:
  `TrackCardComponent` → `track-card.component.ts`.
- No `any`. Type everything or use `unknown` plus a guard.
- Unsubscribe with `takeUntilDestroyed()` — never a manual `Subscription` field.

## Service Template

```ts
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { Track } from '../models/track.model';

@Injectable({ providedIn: 'root' })
export class TrackService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/tracks`;

  list(): Observable<Track[]> {
    return this.http.get<Track[]>(this.baseUrl);
  }
}
```

- `providedIn: 'root'` unless the service is genuinely scoped to a feature.
- Services own HTTP and state. Components own presentation. Never call `HttpClient`
  from a component.
- Every response is typed — no `Observable<any>`.

## Typed Reactive Forms

```ts
private readonly fb = inject(NonNullableFormBuilder);

readonly form = this.fb.group({
  email: this.fb.control('', [Validators.required, Validators.email]),
  displayName: this.fb.control('', [Validators.maxLength(40)]),
});
```

- `NonNullableFormBuilder` — avoids `string | null` on every control.
- Never `new FormControl()` untyped, never `FormGroup<any>`.
- Validate on the client for UX only. The API validates for real.

## File Structure

```
src/app/
  features/<feature>/
    <name>.component.ts
    <name>.component.html
    <name>.component.scss
    <name>.component.spec.ts
  core/services/<name>.service.ts
  models/<name>.model.ts
```

## Xomware UI Notes

- Brand colors via CSS custom properties — never hardcoded hex in a template.
- No pure white backgrounds: use Ivory `#FCFCF2`.
- Square corners — no border radius unless the design explicitly calls for it.
- Implement every interactive state: default, hover, focus, active, disabled, loading,
  error, empty. Focus rings are never removed.

## Testing

Karma + Jasmine. Test the component's public behavior through the template, not its
private methods.

```ts
it('emits the track id when played', () => {
  const fixture = TestBed.createComponent(TrackCardComponent);
  fixture.componentRef.setInput('track', mockTrack);
  const emitted: string[] = [];
  fixture.componentInstance.played.subscribe((id) => emitted.push(id));

  fixture.nativeElement.querySelector('button').click();

  expect(emitted).toEqual([mockTrack.id]);
});
```
