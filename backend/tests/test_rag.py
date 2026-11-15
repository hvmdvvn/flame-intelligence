from app.rag import answer, audit_interpretation, content_terms


def test_audit_rejects_numbers_that_are_not_in_the_quote():
    assert audit_interpretation("The excerpt describes a fabric test.", ["The cotton fabric burned."])
    assert not audit_interpretation("The spread rate was 9.9 mm/s.", ["The cotton fabric burned."])


def test_content_terms_drop_empty_questions():
    assert content_terms("what does the corpus say?") == []


def test_unsupported_lunar_question_is_insufficient(monkeypatch):
    monkeypatch.setattr("app.rag.get_paper", lambda paper_id: {"paper_id": paper_id})
    monkeypatch.setattr("app.rag.corpus_version", lambda: "test")
    monkeypatch.setattr(
        "app.rag.search_chunks",
        lambda *args, **kwargs: [
            {
                "chunk_id": "ntrs:fixture#p1#c1",
                "paper_id": "ntrs:fixture",
                "title": "FIXTURE",
                "official_url": "https://example.invalid",
                "page_number": 1,
                "text": "The cotton fabric burned in microgravity during a forced-flow flame spread test.",
                "score": -1,
            }
        ],
    )
    result = answer("What certified lunar habitat fire risk does this predict?")
    assert result["answer_mode"] == "insufficient"
    assert result["reported"] == []


def test_verbatim_claim_is_a_substring(monkeypatch):
    text = (
        "FIXTURE only. The cotton-fiberglass fabric burned in microgravity. "
        "The fixture text reports a flame spread rate of 2.5 mm/s at 21 percent oxygen under forced flow."
    )
    monkeypatch.setattr("app.rag.get_paper", lambda paper_id: None)
    monkeypatch.setattr("app.rag.corpus_version", lambda: "test")
    monkeypatch.setattr("app.rag.llm_provider", lambda: "none")
    monkeypatch.setattr(
        "app.rag.search_chunks",
        lambda *args, **kwargs: [
            {
                "chunk_id": "ntrs:fixture#p1#c1",
                "paper_id": "ntrs:fixture",
                "title": "FIXTURE — not a NASA record",
                "official_url": "https://example.invalid/fixture",
                "page_number": 1,
                "text": text,
                "score": -0.2,
            }
        ],
    )
    result = answer("What flame spread rate was reported for the cotton fabric in microgravity?")
    assert result["answer_mode"] == "extractive"
    assert result["reported"]
    for claim in result["reported"]:
        assert claim["quote"] in text
        assert claim["quote"] == claim["text"]
    assert any("2.5" in claim["quote"] for claim in result["reported"])
