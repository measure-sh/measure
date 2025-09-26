import { cosineSimilarity, embed } from 'ai';
import * as fs from 'fs';
import * as path from 'path';

export const TEXT_EMBEDDING_MODEL = 'google/gemini-embedding-001'

interface DocChunk {
    id: string;
    filename: string;
    content: string;
    embedding: number[];
}

// Load embeddings from JSON file
let docEmbeddings: DocChunk[] | null = null;

function getDocEmbeddings(): DocChunk[] {
    if (docEmbeddings) {
        return docEmbeddings;
    }

    const jsonPath = path.join(process.cwd(), 'app', 'ai', 'embeddings', 'docs-embeddings.json');
    const jsonData = fs.readFileSync(jsonPath, 'utf-8');
    docEmbeddings = JSON.parse(jsonData);

    return docEmbeddings!;
}

interface DocSearchResult {
    chunk: DocChunk;
    score: number;
}

interface DocSearchResults {
    results: DocSearchResult[];
    inputTokens: number;
}

const queryEmbeddingCache = new Map<string, number[]>();

export async function searchDocs(
    query: string,
    topK: number = 5
): Promise<DocSearchResults> {
    // Get embedding for the query
    const queryEmbedding = await getQueryEmbedding(query);

    // Calculate similarity scores
    const embeddings = getDocEmbeddings();
    const results: DocSearchResult[] = embeddings.map(chunk => ({
        chunk,
        score: cosineSimilarity(queryEmbedding.embedding, chunk.embedding),
    }));

    // Sort by score and return top K
    results.sort((a, b) => b.score - a.score);

    return { results: results.slice(0, topK), inputTokens: queryEmbedding.tokens };
}

async function getQueryEmbedding(query: string): Promise<{ embedding: number[]; tokens: number }> {
    if (queryEmbeddingCache.has(query)) {
        return { embedding: queryEmbeddingCache.get(query)!, tokens: 0 };
    }

    const { embedding, usage } = await embed({
        model: TEXT_EMBEDDING_MODEL,
        value: query,
    });

    if (embedding.length === 0) {
        throw new Error('Failed to generate query embedding');
    }

    queryEmbeddingCache.set(query, embedding);

    return { embedding, tokens: usage.tokens };
}

export function formatDocSearchResults(results: DocSearchResult[]): string {
    if (results.length === 0) {
        return '';
    }

    return results
        .map((result, index) => {
            return `
## Result ${index + 1} (Relevance: ${(result.score * 100).toFixed(1)}%)
File: ${result.chunk.filename}

${result.chunk.content}
`;
        })
        .join('\n---\n');
}