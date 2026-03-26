import re
import unicodedata

import spacy
from langchain_text_splitters import RecursiveCharacterTextSplitter

from app.core.config import settings

_ARTICLE_HEADING_RE = re.compile(
    r"(?im)^(?P<header>(?:article\s+(?:premier|[\divxlcdm]+)|art\.\s*\d+|art\.?\s+[\divxlcdm]+)\s*[-:])"
)

_nlp = None
_DROP_POS = {"DET", "ADP", "CCONJ", "SCONJ"}
_KEEP_LEMMAS = {"non"}


def get_nlp():
    # Charge spaCy une seule fois (lazy singleton).
    global _nlp
    if _nlp is None:
        _nlp = spacy.load(settings.spacy_model, disable=["ner", "textcat"])
        if "parser" not in _nlp.pipe_names and "sentencizer" not in _nlp.pipe_names:
            _nlp.add_pipe("sentencizer")
    return _nlp


def split_sentences(raw_text: str) -> list[str]:
    normalized = unicodedata.normalize("NFKC", raw_text or "")
    normalized = re.sub(r"\s+", " ", normalized).strip()
    if not normalized:
        return []

    nlp = get_nlp()
    doc = nlp(normalized)
    return [sent.text.strip() for sent in doc.sents if sent.text.strip()]


def tokenize_and_lemmatize(sentence: str) -> list[str]:
    nlp = get_nlp()
    doc = nlp(sentence)
    tokens: list[str] = []

    for token in doc:
        if token.is_space:
            continue
        if token.is_stop and token.lemma_.lower() not in _KEEP_LEMMAS:
            continue
        if token.pos_ in _DROP_POS and token.lemma_.lower() not in _KEEP_LEMMAS:
            continue
        if token.like_num:
            tokens.append(token.text)
            continue
        if token.is_punct and token.text not in {".", ",", ";", ":", "(", ")", "-", "/"}:
            continue

        lemma = token.lemma_.strip()
        if not lemma or lemma == "-PRON-":
            lemma = token.text
        lemma = re.sub(r"\s+", "", lemma.lower())
        if lemma:
            tokens.append(lemma)

    return tokens


def clean_text(raw_text: str) -> str:
    # Conserve la formulation juridique originale; on limite le nettoyage a une normalisation legere.
    if not raw_text:
        return ""

    normalized = unicodedata.normalize("NFKC", raw_text)
    normalized = normalized.replace("\r\n", "\n").replace("\r", "\n")
    normalized = re.sub(r"[ \t]+", " ", normalized)
    normalized = re.sub(r"\n{3,}", "\n\n", normalized)
    lines = [line.strip() for line in normalized.split("\n")]
    return "\n".join(line for line in lines if line)


def _split_large_legal_block(block: str) -> list[str]:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=settings.chunk_size,
        chunk_overlap=min(settings.chunk_overlap, max(80, settings.chunk_size // 8)),
        separators=["\n\n", "\n", ". ", "; ", ": ", " ", ""],
    )
    return [chunk.strip() for chunk in splitter.split_text(block) if chunk.strip()]


def _split_by_article(text: str) -> list[str]:
    matches = list(_ARTICLE_HEADING_RE.finditer(text))
    if not matches:
        return []

    blocks: list[str] = []
    preamble = text[: matches[0].start()].strip()
    for index, match in enumerate(matches):
        start = match.start()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        article_block = text[start:end].strip()
        if preamble:
            article_block = f"{preamble}\n\n{article_block}"
            preamble = ""
        if article_block:
            blocks.append(article_block)
    return blocks


def chunk_text(text: str) -> list[str]:
    # Decoupe juridique: d'abord par article, puis sous-chunks si un article est trop long.
    clean = str(text or "").strip()
    if not clean:
        return []

    article_blocks = _split_by_article(clean)
    if article_blocks:
        chunks: list[str] = []
        for block in article_blocks:
            if len(block) <= settings.chunk_size:
                chunks.append(block)
            else:
                chunks.extend(_split_large_legal_block(block))
        return [chunk for chunk in chunks if chunk.strip()]

    return _split_large_legal_block(clean)


def unique_chunks(chunks: list[str]) -> list[str]:
    seen: set[str] = set()
    output: list[str] = []
    for chunk in chunks:
        normalized = re.sub(r"\s+", " ", chunk).strip().lower()
        if not normalized or normalized in seen:
            continue
        # Drop near-duplicates created by overlap windows.
        if any(_token_jaccard(normalized, prev) >= 0.92 for prev in seen):
            continue
        seen.add(normalized)
        output.append(chunk)
    return output


def _token_jaccard(a: str, b: str) -> float:
    a_tokens = set(a.split())
    b_tokens = set(b.split())
    if not a_tokens and not b_tokens:
        return 1.0
    if not a_tokens or not b_tokens:
        return 0.0
    return len(a_tokens & b_tokens) / len(a_tokens | b_tokens)
