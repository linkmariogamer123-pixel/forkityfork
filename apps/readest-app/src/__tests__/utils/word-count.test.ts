import { describe, it, expect, vi } from 'vitest';
import { BlobWriter, TextReader, ZipWriter } from '@zip.js/zip.js';
import { DocumentLoader } from '@/libs/document';
import { countBookDocWords } from '@/utils/book';
import { countTextWords } from '@/utils/word';

if (typeof globalThis['CSS'] === 'undefined') {
  (globalThis as Record<string, unknown>)['CSS'] = {
    escape: (s: string) => s.replace(/([^\w-])/g, '\\$1'),
  };
}
if (!customElements.get('foliate-paginator')) {
  customElements.define(
    'foliate-paginator',
    class extends HTMLElement {
      override setAttribute() {}
      override addEventListener() {}
      open() {}
    },
  );
}
vi.mock('foliate-js/paginator.js', () => ({}));

describe('countTextWords', () => {
  it('counts whitespace-separated words, ignoring punctuation-only tokens', () => {
    expect(countTextWords('  The quick — brown fox.\n\tJumped!  ')).toBe(5);
  });

  it('counts each Chinese or Japanese character as a word', () => {
    expect(countTextWords('我爱读书')).toBe(4);
    expect(countTextWords('read 本を読む now')).toBe(6);
  });

  it('counts Korean by spaces, like English', () => {
    expect(countTextWords('나는 책을 읽는다')).toBe(3);
  });

  it('returns 0 for empty text', () => {
    expect(countTextWords('')).toBe(0);
  });
});

const xhtml = (body: string) =>
  `<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>t</title><style>p { color: red }</style></head><body>${body}</body></html>`;

const makeEpub = async () => {
  const writer = new ZipWriter(new BlobWriter('application/epub+zip'));
  await writer.add('mimetype', new TextReader('application/epub+zip'));
  await writer.add(
    'META-INF/container.xml',
    new TextReader(
      '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
    ),
  );
  await writer.add(
    'OEBPS/content.opf',
    new TextReader(`<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="id">word-count-test</dc:identifier>
    <dc:title>Word Count</dc:title>
    <dc:language>en</dc:language>
  </metadata>
  <manifest>
    <item id="c1" href="c1.xhtml" media-type="application/xhtml+xml"/>
    <item id="c2" href="c2.xhtml" media-type="application/xhtml+xml"/>
    <item id="notes" href="notes.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="c1"/>
    <itemref idref="c2"/>
    <itemref idref="notes" linear="no"/>
  </spine>
</package>`),
  );
  await writer.add(
    'OEBPS/c1.xhtml',
    new TextReader(xhtml('<h1>One</h1><p>It was a dark night.</p><script>var x = 1;</script>')),
  );
  await writer.add('OEBPS/c2.xhtml', new TextReader(xhtml('<p>The end, truly.</p>')));
  await writer.add('OEBPS/notes.xhtml', new TextReader(xhtml('<p>A note left out.</p>')));
  return new File([await writer.close()], 'words.epub', { type: 'application/epub+zip' });
};

describe('countBookDocWords', () => {
  it('counts the main text of every linear section, skipping scripts and styles', async () => {
    const { book, format } = await new DocumentLoader(await makeEpub()).open();
    // "One" + "It was a dark night." + "The end, truly."
    expect(await countBookDocWords(book, format)).toBe(9);
  });

  it('returns undefined for fixed-layout formats', async () => {
    const { book } = await new DocumentLoader(await makeEpub()).open();
    expect(await countBookDocWords(book, 'PDF')).toBeUndefined();
  });
});
