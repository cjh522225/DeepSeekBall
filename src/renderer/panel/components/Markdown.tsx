import { memo, useMemo, useState, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeHighlight from 'rehype-highlight'
import 'katex/dist/katex.min.css'

function extractText(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(extractText).join('')
  const element = node as { props?: { children?: ReactNode } }
  if (element.props?.children) return extractText(element.props.children)
  return ''
}

function CodeBlock({ children, ...rest }: { children?: ReactNode }): JSX.Element {
  const [copied, setCopied] = useState(false)
  const codeElement = Array.isArray(children) ? children[0] : children
  const className =
    (codeElement as { props?: { className?: string } })?.props?.className ?? ''
  const language = /language-([\w-]+)/.exec(className)?.[1] ?? ''
  const text = extractText(codeElement).replace(/\n$/, '')

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    } catch {
      void 0
    }
  }

  return (
    <div className="code-block">
      <div className="code-block-header">
        <span>{language || 'text'}</span>
        <button
          type="button"
          className="rounded px-1.5 py-0.5 transition-colors hover:bg-black/10 dark:hover:bg-white/10"
          onClick={copy}
        >
          {copied ? '已复制' : '复制'}
        </button>
      </div>
      <pre {...rest}>{children}</pre>
    </div>
  )
}

const remarkPlugins = [remarkGfm, remarkMath]
const rehypePlugins = [rehypeKatex, [rehypeHighlight, { detect: true, ignoreMissing: true }] as never]

export const Markdown = memo(function Markdown({ content }: { content: string }): JSX.Element {
  const components = useMemo(
    () => ({
      pre: CodeBlock,
      a: ({ children, href }: { children?: ReactNode; href?: string }) => (
        <a href={href} target="_blank" rel="noreferrer">
          {children}
        </a>
      )
    }),
    []
  )
  return (
    <div className="md-body">
      <ReactMarkdown
        remarkPlugins={remarkPlugins as never}
        rehypePlugins={rehypePlugins as never}
        components={components as never}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
})
