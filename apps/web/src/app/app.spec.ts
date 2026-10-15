import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ConnectionStore } from '@restaurant/web/core';
import { App } from './app';

describe('App shell', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('renders navigation links to every screen', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const links = [...(fixture.nativeElement as HTMLElement).querySelectorAll('nav a')].map((a) =>
      a.textContent?.trim(),
    );
    expect(links).toEqual(['Menu', 'Orders', 'Setup']);
  });

  it('shows the connection state', async () => {
    const fixture = TestBed.createComponent(App);
    const store = TestBed.inject(ConnectionStore);
    store.setSse('live');
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).querySelector('.live')?.textContent).toContain(
      'Live',
    );
    store.setOnline(false);
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).querySelector('.live')?.textContent).toContain(
      'Offline',
    );
  });
});
