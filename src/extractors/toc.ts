import * as cheerio from 'cheerio';
import type { TocEntry } from '../shared/types.js';

export function parseToc(html: string): TocEntry[] {
  const $ = cheerio.load(html);
  const entries: TocEntry[] = [];

  // beck-online TOC is typically in the left navigation tree
  // Look for the navigation tree structure
  const navTree = $('.tree, .navigation-tree, .inhaltsverzeichnis, .toc, #treeRoot, .spalte-links ul');

  if (!navTree.length) {
    // Fallback: try to find links in the main content that point to sub-documents
    $('a[href*="vpath="]').each((_, el) => {
      const $el = $(el);
      const href = $el.attr('href') ?? '';
      const text = $el.text().trim();
      const vpathMatch = href.match(/vpath=([^&]+)/);

      if (text && vpathMatch) {
        entries.push({
          title: text,
          vpath: decodeURIComponent(vpathMatch[1]),
          depth: 0,
        });
      }
    });
    return entries;
  }

  function parseList(listEl: ReturnType<typeof $>, depth: number) {
    listEl.children('li').each((_, li) => {
      const $li = $(li);
      const link = $li.children('a').first();
      const text = link.text().trim() || $li.children('span').first().text().trim();
      const href = link.attr('href') ?? '';
      const vpathMatch = href.match(/vpath=([^&]+)/);

      if (text) {
        const entry: TocEntry = {
          title: text,
          vpath: vpathMatch ? decodeURIComponent(vpathMatch[1]) : '',
          depth,
        };

        // Check for nested list
        const nestedUl = $li.children('ul');
        if (nestedUl.length) {
          entry.children = [];
          nestedUl.children('li').each((_, childLi) => {
            const $childLi = $(childLi);
            const childLink = $childLi.children('a').first();
            const childText = childLink.text().trim();
            const childHref = childLink.attr('href') ?? '';
            const childVpath = childHref.match(/vpath=([^&]+)/);

            if (childText) {
              entry.children!.push({
                title: childText,
                vpath: childVpath ? decodeURIComponent(childVpath[1]) : '',
                depth: depth + 1,
              });
            }
          });
        }

        entries.push(entry);
      }
    });
  }

  navTree.each((_, tree) => {
    const $tree = $(tree);
    if ($tree.is('ul')) {
      parseList($tree, 0);
    } else {
      const rootUl = $tree.find('ul').first();
      if (rootUl.length) parseList(rootUl, 0);
    }
  });

  return entries;
}
