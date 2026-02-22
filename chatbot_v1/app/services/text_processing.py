import re
import unicodedata

import spacy
from langchain_text_splitters import RecursiveCharacterTextSplitter

from app.config import settings

_nlp = None
_DROP_POS = {"DET", "ADP", "CCONJ", "SCONJ"}
_KEEP_LEMMAS = {"non"}


def get_nlp():
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
    if not raw_text:
        return ""

    sentences = split_sentences(raw_text)
    cleaned_sentences: list[str] = []

    for sentence in sentences:
        tokens = tokenize_and_lemmatize(sentence)
        cleaned = " ".join(tokens).strip()
        if cleaned:
            cleaned_sentences.append(cleaned)

    return "\n".join(cleaned_sentences)


def chunk_text(text: str) -> list[str]:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=settings.chunk_size,
        chunk_overlap=settings.chunk_overlap,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    return [chunk for chunk in splitter.split_text(text) if chunk.strip()]


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
