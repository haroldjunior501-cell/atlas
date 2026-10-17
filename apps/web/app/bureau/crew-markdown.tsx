import { Fragment, type ReactNode } from 'react'
import styles from './crew-board.module.css'

function inline(text: string, sources: string[], key: string): ReactNode[] {
  const parts: ReactNode[] = []
  const pattern = /(\*\*[^*]+\*\*|\[\d+\]|https?:\/\/[^\s)|]+|_[^_]+_)/g
  let last = 0
  let index = 0
  for (const match of text.matchAll(pattern)) {
    const at = match.index ?? 0
    if (at > last) parts.push(text.slice(last, at))
    const token = match[0]
    const id = `${key}-${index++}`
    if (token.startsWith('**')) parts.push(<strong key={id}>{token.slice(2, -2)}</strong>)
    else if (token.startsWith('_')) parts.push(<em key={id}>{token.slice(1, -1)}</em>)
    else if (token.startsWith('[')) {
      const url = sources[Number(token.slice(1, -1)) - 1]
      parts.push(url ? <a key={id} className={styles.cite} href={url} target="_blank" rel="noreferrer">{token}</a> : token)
    } else parts.push(<a key={id} href={token} target="_blank" rel="noreferrer">{token.replace(/^https?:\/\/(www\.)?/, '').slice(0, 60)}</a>)
    last = at + token.length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

/** Rendu Markdown minimal et sûr (aucun HTML injecté) pour les rapports d’agents. */
export function CrewMarkdown({ text }: { text: string }) {
  const sources = [...text.matchAll(/^\s*\[(\d+)\]\s*(https?:\/\/\S+)/gm)].reduce<string[]>((acc, match) => {
    acc[Number(match[1]) - 1] = match[2]!
    return acc
  }, [])
  const lines = text.replace(/\r/g, '').split('\n')
  const blocks: ReactNode[] = []
  let list: string[] = []
  let table: string[][] = []
  const flush = (key: string) => {
    if (list.length) {
      blocks.push(<ul key={`l-${key}`}>{list.map((item, i) => <li key={i}>{inline(item, sources, `${key}-${i}`)}</li>)}</ul>)
      list = []
    }
    if (table.length) {
      const [head, ...rows] = table
      blocks.push(
        <div key={`t-${key}`} className={styles.tableWrap}>
          <table>
            <thead><tr>{head!.map((cell, i) => <th key={i}>{inline(cell, sources, `${key}-h${i}`)}</th>)}</tr></thead>
            <tbody>{rows.map((row, r) => <tr key={r}>{row.map((cell, i) => <td key={i}>{inline(cell, sources, `${key}-${r}-${i}`)}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      )
      table = []
    }
  }
  lines.forEach((raw, index) => {
    const line = raw.trimEnd()
    const key = String(index)
    if (/^\s*\|/.test(line)) {
      if (list.length) flush(key)
      const cells = line.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim())
      if (cells.every((cell) => /^:?-{2,}:?$/.test(cell))) return
      table.push(cells)
      return
    }
    if (/^\s*[-*•]\s+/.test(line)) {
      if (table.length) flush(key)
      list.push(line.replace(/^\s*[-*•]\s+/, ''))
      return
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      if (table.length) flush(key)
      list.push(line.trim())
      return
    }
    flush(key)
    if (!line.trim() || /^-{3,}$/.test(line.trim())) return
    const heading = line.match(/^(#{1,4})\s+(.*)$/)
    if (heading) {
      const Tag = (heading[1]!.length <= 1 ? 'h3' : 'h4') as 'h3' | 'h4'
      blocks.push(<Tag key={key}>{inline(heading[2]!, sources, key)}</Tag>)
      return
    }
    blocks.push(<div key={key} className={styles.para}>{inline(line, sources, key)}</div>)
  })
  flush('end')
  return <div className={styles.md}>{blocks.map((block, i) => <Fragment key={i}>{block}</Fragment>)}</div>
}
