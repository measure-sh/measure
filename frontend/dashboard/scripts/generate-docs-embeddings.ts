import { TEXT_EMBEDDING_MODEL } from '@/app/ai/rag';
import * as fs from 'fs';
import * as path from 'path';


interface DocChunk {
    id: string;
    filename: string;
    content: string;
    embedding: number[];
}

async function generateDocsEmbeddings() {
    console.log('Reading Measure documentation from ./docs...');

    // 1. Read docs from local filesystem
    const docsPath = path.join(process.cwd(), '../../docs');

    const excludedPaths = ['api'];

    const mdFiles: string[] = getMdFiles(docsPath, excludedPaths);

    console.log(`Found ${mdFiles.length} documentation files`);

    // 2. Read all files
    const docs = mdFiles.map(filepath => {
        const relativePath = path.relative(docsPath, filepath);
        const content = fs.readFileSync(filepath, 'utf-8');
        console.log(`Read ${filepath} (${(content.length / 1024).toFixed(2)} KB)`);

        return {
            relativeFilename: relativePath,
            content: content
        };
    });

    // 3. Chunk documents (split into smaller pieces)
    console.log('\nChunking documents...');
    const chunks: Omit<DocChunk, 'embedding'>[] = [];

    for (const doc of docs) {
        const docChunks = chunkDocument(doc.content, doc.relativeFilename);
        chunks.push(...docChunks);
        console.log(`  ${doc.relativeFilename}: ${docChunks.length} chunks`);
    }

    console.log(`\nTotal chunks created: ${chunks.length}`);

    // 4. Generate embeddings using AI SDK
    console.log('\nGenerating embeddings...');

    if (!process.env.AI_GATEWAY_API_KEY) {
        console.error('\n❌ ERROR: AI_GATEWAY_API_KEY not found in environment');
        console.log('\nTo generate embeddings, you need your AI Gateway API key.');
        console.log('Export it: export AI_GATEWAY_API_KEY=your-key');
        process.exit(1);
    }

    const docChunksWithEmbeddings: DocChunk[] = [];

    // Process all chunks
    const embeddings = await getEmbeddings(chunks.map(c => c.content));

    for (let i = 0; i < chunks.length; i++) {
        docChunksWithEmbeddings.push({
            ...chunks[i],
            embedding: embeddings[i]
        });
    }

    console.log(`✓ Generated ${docChunksWithEmbeddings.length} embeddings`);

    // Save to json file
    console.log('\nSaving embeddings...');

    // Ensure app/ai/embeddings directory exists
    const embeddingsPath = path.join(process.cwd(), 'app', 'ai', 'embeddings');
    if (!fs.existsSync(embeddingsPath)) {
        fs.mkdirSync(embeddingsPath, { recursive: true });
    }

    const embeddingsFilePath = path.join(embeddingsPath, 'docs-embeddings.json');
    fs.writeFileSync(embeddingsFilePath, JSON.stringify(docChunksWithEmbeddings), 'utf-8');
    console.log(`✓ JSON version saved to: ${path.relative(process.cwd(), embeddingsFilePath)}`);

    console.log('\n📊 Statistics:');
    console.log(`   Average chunk size: ${Math.round(chunks.reduce((sum, c) => sum + c.content.length, 0) / chunks.length)} chars`);
    console.log(`   Embedding dimensions: ${docChunksWithEmbeddings[0].embedding.length}`);
    console.log(`   Model: ${TEXT_EMBEDDING_MODEL}`);
}

function getMdFiles(
    dir: string,
    excludeDirs: string[] = ['api']
): string[] {
    let results: string[] = [];
    const list: string[] = fs.readdirSync(dir);

    list.forEach((file: string) => {
        const filePath: string = path.join(dir, file);
        const stat: fs.Stats = fs.statSync(filePath);

        if (stat.isDirectory()) {
            // Skip directories in excludeDirs list
            if (!excludeDirs.includes(file)) {
                results = results.concat(getMdFiles(filePath, excludeDirs));
            }
        } else if (file.endsWith('.md')) {
            results.push(filePath);
        }
    });

    return results;
}

function chunkDocument(content: string, filename: string, maxChunkSize = 2000): Omit<DocChunk, 'embedding'>[] {
    const chunks: Omit<DocChunk, 'embedding'>[] = [];

    // Split by headers first (preserves structure)
    const sections = content.split(/^(#{1,6}\s+.+)$/gm);

    let currentChunk = '';
    let currentHeader = '';

    for (let i = 0; i < sections.length; i++) {
        const section = sections[i];

        if (!section.trim()) continue;

        // Check if this is a header
        if (section.match(/^#{1,6}\s+/)) {
            currentHeader = section.trim();
            continue;
        }

        const lines = section.split('\n');

        for (const line of lines) {
            if (currentChunk.length + line.length > maxChunkSize && currentChunk.length > 0) {
                // Save current chunk
                chunks.push({
                    id: `${filename}-${chunks.length}`,
                    filename: filename,
                    content: `${currentHeader ? currentHeader + '\n\n' : ''}${currentChunk.trim()}`
                });
                currentChunk = '';
            }

            currentChunk += line + '\n';
        }
    }

    // Add remaining chunk
    if (currentChunk.trim()) {
        chunks.push({
            id: `${filename}-${chunks.length}`,
            filename: filename,
            content: `${currentHeader ? currentHeader + '\n\n' : ''}${currentChunk.trim()}`
        });
    }

    return chunks;
}

async function getEmbeddings(texts: string[]): Promise<number[][]> {
    const { embedMany } = await import('ai');

    console.log(`  Embedding ${texts.length} chunks...`);

    // Use embedMany to get embeddings for all chunks in one API call
    const { embeddings } = await embedMany({
        model: TEXT_EMBEDDING_MODEL,
        values: texts,
    });

    return embeddings;
}

// Run the script
generateDocsEmbeddings().catch((error) => {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
});