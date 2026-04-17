/**
 * Página institucional genérica (CMS simples - editor visual)
 *
 * - Admin (isAdmin=true): edita conteúdo em editor visual (ReactQuill) e salva no Supabase (site_pages.content_html)
 * - Opção is_visible: se false, não-admin é redirecionado (a página “não existe” para eles); admin vê aviso e edita
 *
 * Mantém o layout padrão (Header/Footer + header gradiente + card branco).
 */
import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import Header from '../components/Header'
import Footer from '../components/Footer'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import ReactQuill from 'react-quill'
import DOMPurify from 'dompurify'

import 'react-quill/dist/quill.snow.css'

type Props = {
    pageKey: string
    title: string
    subtitle: string
    icon?: React.ReactNode
    defaultContent?: string // HTML inicial
}

export default function SitePage({
    pageKey,
    title,
    subtitle,
    icon,
    defaultContent = '',
}: Props) {
    const { isAdmin } = useAuth()
    const [contentHtml, setContentHtml] = useState<string>('')
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    // Estado para feedback visual de salvamento
    const [saveStatus, setSaveStatus] = useState<'success' | 'error' | null>(null)
    const [visibleToUsers, setVisibleToUsers] = useState(true)

    // Toolbar simples e fácil pro cliente (alinhamento, negrito, lista, link, etc.)
    const quillModules = useMemo(() => {
        return {
            toolbar: [
                [{ header: [1, 2, 3, false] }],
                ['bold', 'italic', 'underline'],
                [{ align: [] }], // left, center, right, justify
                [{ list: 'ordered' }, { list: 'bullet' }],
                ['link'],
                ['clean'],
            ],
        }
    }, [])

    const quillFormats = useMemo(
        () => ['header', 'bold', 'italic', 'underline', 'align', 'list', 'bullet', 'link'],
        []
    )

    useEffect(() => {
        async function load() {
            try {
                setLoading(true)
                setError(null)

                // Busca primeiro content_html; se não existir, faz fallback para content_md (caso você já tenha dados antigos)
                const { data, error: err } = await supabase
                    .from('site_pages')
                    .select('content_html, content_md, is_visible')
                    .eq('key', pageKey)
                    .maybeSingle()

                if (err) throw err

                const fromDb = (data?.content_html && data.content_html.trim().length > 0)
                    ? data.content_html
                    : (data?.content_md ?? '')

                setContentHtml((fromDb ?? defaultContent) || '')
                setVisibleToUsers((data as { is_visible?: boolean } | null)?.is_visible !== false)
            } catch (e) {
                console.error('[SitePage] Erro ao carregar conteúdo:', e)
                setError('Erro ao carregar conteúdo')
                setContentHtml(defaultContent || '')
            } finally {
                setLoading(false)
            }
        }

        load()
    }, [pageKey, defaultContent])

    async function handleSave() {
        try {
            setSaving(true)
            setError(null)

            // MODIFIQUEI AQUI - Permitir classes do Quill (ql-align-*)
            const sanitized = DOMPurify.sanitize(contentHtml, {
                USE_PROFILES: { html: true },
                ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
            })

            const { error: err } = await supabase.from('site_pages').upsert({
                key: pageKey,
                title,
                content_html: sanitized,
                is_visible: visibleToUsers,
            })

            if (err) throw err

            // Feedback visual via popup
            setSaveStatus('success')
            setContentHtml(sanitized)

            // Esconder popup automaticamente
            setTimeout(() => setSaveStatus(null), 3000)

        } catch (e) {
            // Feedback visual de erro
            setSaveStatus('error')
            setTimeout(() => setSaveStatus(null), 3000)

        } finally {
            setSaving(false)
        }
    }

    const sanitizedForRender = useMemo(() => {
        const html = contentHtml || '<p><em>Nenhum conteúdo cadastrado ainda.</em></p>'
        // Permitir classes do Quill (ql-align-*)
        return DOMPurify.sanitize(html, {
            USE_PROFILES: { html: true },
            ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
        })

    }, [contentHtml])

    if (loading) {
        return (
            <div className="min-h-screen bg-[#F9F9F9] flex flex-col">
                <Header />
                <div className="flex items-center justify-center flex-1">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1E7F43] mx-auto"></div>
                        <p className="mt-4 text-[#1F1F1F]/70">Carregando conteúdo...</p>
                    </div>
                </div>
                <Footer />
            </div>
        )
    }

    if (!visibleToUsers && !isAdmin) {
        return <Navigate to="/contests" replace />
    }

    return (
        <div className="min-h-screen bg-[#F9F9F9] flex flex-col">
            <Header />

            {/* Header da Página com Gradiente */}
            <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden mx-2 sm:mx-4 mt-4 sm:mt-6 mb-6 sm:mb-8 shadow-xl">
                <div className="absolute inset-0 bg-gradient-to-br from-[#1E7F43] via-[#1E7F43] to-[#3CCB7F] opacity-95"></div>
                <div className="relative bg-white/5 backdrop-blur-sm p-4 sm:p-6 md:p-8">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="p-2 sm:p-3 bg-white/20 rounded-lg sm:rounded-xl shrink-0">
                                {icon ?? (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 6H7a2 2 0 01-2-2V4a2 2 0 012-2h10a2 2 0 012 2v16a2 2 0 01-2 2z" />
                                    </svg>
                                )}
                            </div>
                            <div className="min-w-0">
                                <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white">{title}</h1>
                                <p className="text-white/90 text-sm sm:text-base mt-1">{subtitle}</p>
                            </div>
                        </div>
                        {isAdmin && !visibleToUsers && (
                            <span
                                className="shrink-0 inline-flex items-center rounded-full bg-[#1F1F1F]/35 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white ring-1 ring-white/30"
                                title="Utilizadores e visitantes não veem esta página (são redirecionados)."
                            >
                                Invisível para utilizadores
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Conteúdo */}
            <div className="container mx-auto px-2 sm:px-4 pb-6 sm:pb-8 flex-1 max-w-7xl">
                <div className="rounded-2xl sm:rounded-3xl border border-[#E5E5E5] bg-white p-4 sm:p-6 md:p-8 shadow-xl">
                    {error && (
                        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                            {error}
                        </div>
                    )}

                    {/* Admin Editor */}
                    {isAdmin && (
                        <div className="mb-6">
                            <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-[#E5E5E5] bg-[#F9F9F9] px-4 py-3">
                                <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-[#1F1F1F]">
                                    <input
                                        type="checkbox"
                                        checked={visibleToUsers}
                                        onChange={(e) => setVisibleToUsers(e.target.checked)}
                                        className="h-4 w-4 rounded border-[#E5E5E5] text-[#1E7F43] focus:ring-[#3CCB7F]/40"
                                    />
                                    Página visível para utilizadores
                                </label>
                            </div>
                            <div className="flex items-center justify-between gap-3 mb-3">
                                <div className="text-sm font-semibold text-[#1F1F1F]">Editar conteúdo</div>
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="rounded-lg sm:rounded-xl px-4 py-2 font-bold bg-[#1E7F43] text-white shadow-lg hover:shadow-xl hover:bg-[#3CCB7F] transition-all text-sm disabled:opacity-60"
                                >
                                    {saving ? 'Salvando...' : 'Salvar'}
                                </button>
                            </div>

                            <div className="rounded-xl border border-[#E5E5E5] overflow-hidden">
                                <ReactQuill
                                    theme="snow"
                                    value={contentHtml}
                                    onChange={setContentHtml}
                                    modules={quillModules}
                                    formats={quillFormats}
                                />
                            </div>

                            <div className="mt-2 text-xs text-[#1F1F1F]/60">
                                Dica: use os botões de alinhamento (⬅️ ⬆️ ➡️) e o botão de link 🔗 para inserir links.
                            </div>

                            <hr className="my-6" />
                            <div className="text-sm font-semibold text-[#1F1F1F] mb-2">Pré-visualização</div>
                        </div>
                    )}

                    {/* Render (usuário e admin) */}
                    <div className="ql-editor sitepage-content">
                        <div
                            className="prose prose-sm sm:prose-base max-w-none"
                            dangerouslySetInnerHTML={{ __html: sanitizedForRender }}
                        />
                    </div>
                </div>
            </div>
            {saveStatus && (
                <div className="fixed bottom-4 right-4 z-50">
                    <div
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-semibold transition-all
                            ${saveStatus === 'success'
                                ? 'bg-[#1E7F43] text-white'
                                : 'bg-red-600 text-white'
                            }`}
                    >
                        {saveStatus === 'success'
                            ? '✅ Conteúdo salvo com sucesso!'
                            : '❌ Erro ao salvar conteúdo'}
                    </div>
                </div>
            )}
            <Footer />
        </div>
    )
}
