import * as cheerio from 'cheerio';
import type { SearchResult, SearchResponse } from '../shared/types.js';

export function parseSearchResults(html: string, currentPage: number): SearchResponse {
  const $ = cheerio.load(html);
  const results: SearchResult[] = [];

  $('.treffer-wrapper').each((i, el) => {
    const wrapper = $(el);
    const dataInner = wrapper.find('.treffer-data-inner');
    if (!dataInner.length) return;

    // First line: source title (e.g., "Münchener Kommentar BGB")
    const firstLineLink = dataInner.find('.treffer-firstline-wrapper a').first();
    const sourceTitle = firstLineLink.text().trim();

    // Second link: section title (e.g., "§ 314 Kündigung von Dauerschuldverhältnissen")
    const links = dataInner.find('a[href*="/Dokument"]');
    const sectionLink = links.length > 1 ? links.eq(1) : links.first();
    const sectionTitle = sectionLink.text().trim();

    // Extract vpath from href
    const href = sectionLink.attr('href') ?? firstLineLink.attr('href') ?? '';
    const vpathMatch = href.match(/vpath=([^&]+)/);
    const vpath = vpathMatch ? decodeURIComponent(vpathMatch[1]) : '';

    // Citation line (the text node after the links)
    const allText = dataInner.text().trim();
    const citationMatch = allText.match(/(?:in\s+)?[\w/]+\s*\|\s*[^|]+\|\s*[\d.]+\.\s*Auflage\s+\d{4}/);
    const citation = citationMatch ? citationMatch[0].trim() : '';

    if (sourceTitle || sectionTitle) {
      results.push({
        position: i + 1 + (currentPage - 1) * 10,
        sourceTitle,
        sectionTitle,
        citation,
        vpath,
        url: href.startsWith('/') ? `https://beck-online.beck.de${href}` : href,
      });
    }
  });

  // Extract total pages from pagination
  let totalPages = 1;
  const pagingText = $('.searchBarOption_MainContainer').text();
  const pageMatch = pagingText.match(/Seite\s+\d+\s+von\s+(\d+)/);
  if (pageMatch) {
    totalPages = parseInt(pageMatch[1], 10);
  }

  return {
    results,
    totalPages,
    currentPage,
  };
}
