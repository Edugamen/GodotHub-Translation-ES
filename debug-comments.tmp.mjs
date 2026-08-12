import fs from 'node:fs'
import ts from 'typescript'

const text = fs.readFileSync('src/ui/classic/components/git/GitSidebar.tsx', 'utf8')
const idx = text.indexOf('fallback')
console.log('fallback at', idx, JSON.stringify(text.slice(idx - 60, idx + 30)))

const sf = ts.createSourceFile('g.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const walk = (node) => {
  if (node.kind === ts.SyntaxKind.Block || node.kind === ts.SyntaxKind.CatchClause) {
    const s = node.getStart(); const e = node.getEnd()
    if (text.slice(s, e).includes('fallback')) {
      let hasChild = false
      ts.forEachChild(node, () => { hasChild = true; return true })
      console.log(`${ts.SyntaxKind[node.kind]} [${s},${e}) hasChild=${hasChild} text=${JSON.stringify(text.slice(s, e))}`)
      const cs = ts.getLeadingCommentRanges(text, s + 1)
      console.log('  interior comments:', cs ? cs.map((c) => [c.pos, c.end, text.slice(c.pos, c.end)]) : 'none')
    }
  }
  ts.forEachChild(node, walk)
}
walk(sf)
