import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, of } from 'rxjs';

export interface NewsItem { id: string; title: string; description: string; imageUrl: string; }

@Injectable({ providedIn: 'root' })
export class ContentService {
  private http = inject(HttpClient);
  base = 'http://localhost:4000/api';

  // Mirrors VideoAndNews.tsx: doc(news_and_video/hero_video) + collection news_and_video
  // Backend has no content table yet -> graceful fallback to null/[] (same as React empty div)
  videoUrl() {
    return this.http.get<{ videoUrl: string }>(`${this.base}/content/hero-video`).pipe(
      catchError(() => of({ videoUrl: '' as string }))
    );
  }
  news() {
    return this.http.get<NewsItem[]>(`${this.base}/content/news`).pipe(
      catchError(() => of([] as NewsItem[]))
    );
  }

  toEmbed(url: string): string {
    if (url.includes('youtube.com/watch')) {
      const v = new URL(url).searchParams.get('v');
      return `https://www.youtube.com/embed/${v}`;
    } else if (url.includes('youtu.be')) {
      return `https://www.youtube.com/embed/${url.split('/').pop()}`;
    }
    return url;
  }
  videoId(url: string): string {
    if (url.includes('youtube.com/watch')) return new URL(url).searchParams.get('v') || '';
    if (url.includes('youtu.be')) return url.split('/').pop() || '';
    return '';
  }
}
