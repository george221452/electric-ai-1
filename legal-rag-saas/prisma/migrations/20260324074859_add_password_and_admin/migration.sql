-- AlterTable
ALTER TABLE "users" ADD COLUMN     "is_admin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "password" TEXT;

-- CreateTable
CREATE TABLE "feedback" (
    "id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "reason" TEXT,
    "confidence" INTEGER NOT NULL,
    "citations" JSONB,
    "metadata" JSONB,
    "user_id" TEXT,
    "workspace_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rag_architecture_settings" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "active_architecture" TEXT NOT NULL DEFAULT 'legacy',
    "chunk_max_size" INTEGER NOT NULL DEFAULT 1500,
    "chunk_min_size" INTEGER NOT NULL DEFAULT 200,
    "chunk_overlap" INTEGER NOT NULL DEFAULT 100,
    "preserve_paragraph_boundaries" BOOLEAN NOT NULL DEFAULT true,
    "preserve_sentence_boundaries" BOOLEAN NOT NULL DEFAULT true,
    "clean_diacritics" BOOLEAN NOT NULL DEFAULT true,
    "remove_extra_whitespace" BOOLEAN NOT NULL DEFAULT true,
    "fix_hyphenated_words" BOOLEAN NOT NULL DEFAULT true,
    "embedding_model" TEXT NOT NULL DEFAULT 'text-embedding-3-small',
    "embedding_dimensions" INTEGER NOT NULL DEFAULT 1536,
    "embedding_batch_size" INTEGER NOT NULL DEFAULT 100,
    "legacy_use_keyword_search" BOOLEAN NOT NULL DEFAULT true,
    "legacy_use_vector_search" BOOLEAN NOT NULL DEFAULT true,
    "legacy_min_score_threshold" DOUBLE PRECISION NOT NULL DEFAULT 0.40,
    "legacy_max_results" INTEGER NOT NULL DEFAULT 10,
    "legacy_final_results" INTEGER NOT NULL DEFAULT 3,
    "legacy_search_strategy" TEXT NOT NULL DEFAULT 'parallel',
    "legacy_combine_method" TEXT NOT NULL DEFAULT 'merge',
    "legacy_openai_model" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    "legacy_max_tokens" INTEGER NOT NULL DEFAULT 500,
    "legacy_temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.2,
    "legacy_system_prompt" TEXT NOT NULL DEFAULT 'Ești un asistent specializat în normative electrice românești.',
    "legacy_prompt_template" TEXT NOT NULL DEFAULT 'standard',
    "legacy_include_citations" BOOLEAN NOT NULL DEFAULT true,
    "legacy_require_citations" BOOLEAN NOT NULL DEFAULT true,
    "hybrid_use_keyword_search" BOOLEAN NOT NULL DEFAULT true,
    "hybrid_use_vector_search" BOOLEAN NOT NULL DEFAULT true,
    "hybrid_use_synonym_expansion" BOOLEAN NOT NULL DEFAULT false,
    "hybrid_synonym_max_variants" INTEGER NOT NULL DEFAULT 3,
    "hybrid_use_numerical_boost" BOOLEAN NOT NULL DEFAULT false,
    "hybrid_numerical_boost_weight" DOUBLE PRECISION NOT NULL DEFAULT 0.3,
    "hybrid_use_smart_router" BOOLEAN NOT NULL DEFAULT false,
    "hybrid_smart_router_quiz_threshold" DOUBLE PRECISION NOT NULL DEFAULT 0.75,
    "hybrid_smart_router_normal_threshold" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "hybrid_smart_router_max_retries" INTEGER NOT NULL DEFAULT 2,
    "hybrid_use_confidence_optimizer" BOOLEAN NOT NULL DEFAULT false,
    "hybrid_use_query_understanding" BOOLEAN NOT NULL DEFAULT false,
    "hybrid_use_intent_detection" BOOLEAN NOT NULL DEFAULT false,
    "hybrid_min_score_threshold" DOUBLE PRECISION NOT NULL DEFAULT 0.40,
    "hybrid_max_results" INTEGER NOT NULL DEFAULT 10,
    "hybrid_final_results" INTEGER NOT NULL DEFAULT 3,
    "hybrid_rerank_enabled" BOOLEAN NOT NULL DEFAULT false,
    "hybrid_rerank_method" TEXT NOT NULL DEFAULT 'score',
    "hybrid_openai_model" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    "hybrid_max_tokens" INTEGER NOT NULL DEFAULT 600,
    "hybrid_temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.2,
    "hybrid_system_prompt" TEXT NOT NULL DEFAULT 'Ești un asistent specializat în normative electrice românești.',
    "hybrid_prompt_template" TEXT NOT NULL DEFAULT 'adaptive',
    "hybrid_include_citations" BOOLEAN NOT NULL DEFAULT true,
    "hybrid_require_citations" BOOLEAN NOT NULL DEFAULT true,
    "hybrid_quiz_enabled" BOOLEAN NOT NULL DEFAULT true,
    "hybrid_quiz_strict_mode" BOOLEAN NOT NULL DEFAULT false,
    "hybrid_quiz_confidence_threshold" INTEGER NOT NULL DEFAULT 70,
    "enable_query_cache" BOOLEAN NOT NULL DEFAULT true,
    "cache_ttl_seconds" INTEGER NOT NULL DEFAULT 3600,
    "enable_result_cache" BOOLEAN NOT NULL DEFAULT false,
    "result_cache_ttl_seconds" INTEGER NOT NULL DEFAULT 86400,
    "show_debug_info" BOOLEAN NOT NULL DEFAULT false,
    "log_queries" BOOLEAN NOT NULL DEFAULT true,
    "log_performance_metrics" BOOLEAN NOT NULL DEFAULT false,
    "enable_query_tracing" BOOLEAN NOT NULL DEFAULT false,
    "answer_format" TEXT NOT NULL DEFAULT 'markdown',
    "include_sources" BOOLEAN NOT NULL DEFAULT true,
    "include_confidence_score" BOOLEAN NOT NULL DEFAULT true,
    "include_execution_time" BOOLEAN NOT NULL DEFAULT false,
    "add_document_banner" BOOLEAN NOT NULL DEFAULT false,
    "fallback_on_low_confidence" BOOLEAN NOT NULL DEFAULT true,
    "fallback_confidence_threshold" INTEGER NOT NULL DEFAULT 40,
    "fallback_to_general_knowledge" BOOLEAN NOT NULL DEFAULT false,
    "show_clarification_on_no_results" BOOLEAN NOT NULL DEFAULT true,
    "extract_metadata" BOOLEAN NOT NULL DEFAULT true,
    "extract_article_numbers" BOOLEAN NOT NULL DEFAULT true,
    "extract_keywords" BOOLEAN NOT NULL DEFAULT true,
    "classify_paragraphs" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,

    CONSTRAINT "rag_architecture_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "feedback_workspace_id_idx" ON "feedback"("workspace_id");

-- CreateIndex
CREATE INDEX "feedback_rating_idx" ON "feedback"("rating");

-- CreateIndex
CREATE INDEX "feedback_created_at_idx" ON "feedback"("created_at");
