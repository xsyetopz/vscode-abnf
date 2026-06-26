import {
	type CancellationToken,
	type DocumentFormattingEditProvider,
	type FormattingOptions,
	Range,
	type TextDocument,
	TextEdit,
} from "vscode";
import {
	type AbnfAlternativeIndent,
	type AbnfBreakAlternatives,
	type AbnfFormatterConfig,
	formatAbnfDocument,
} from "../abnf/format.ts";
import { readGrammarConfig } from "./config.ts";
import {
	formatProductionGrammarDocument,
	type GenericGrammarFormatterConfig,
} from "./format.ts";
import { grammarDialectFromLanguageId } from "./grammar.ts";

/**
 * VS Code document formatter for ABNF and production grammar dialects.
 */
export class GrammarFormattingProvider
	implements DocumentFormattingEditProvider
{
	provideDocumentFormattingEdits(
		document: TextDocument,
		_options: FormattingOptions,
		_token: CancellationToken,
	): TextEdit[] {
		const text = document.getText();
		if (text.trim().length === 0) {
			return [];
		}
		const config = readFormattingConfig();
		const dialect = grammarDialectFromLanguageId(document.languageId);
		const result =
			dialect === "abnf"
				? formatAbnfDocument(text, config)
				: formatProductionGrammarDocument(text, dialect, config);
		const fullRange = new Range(
			document.positionAt(0),
			document.positionAt(text.length),
		);
		return [TextEdit.replace(fullRange, result)];
	}
}

function readFormattingConfig(): AbnfFormatterConfig &
	GenericGrammarFormatterConfig {
	return {
		alignEquals: readGrammarConfig<boolean>("formatting.alignEquals", true),
		continuationIndent: readGrammarConfig<number>(
			"formatting.continuationIndent",
			4,
		),
		alternativeIndent: readGrammarConfig<AbnfAlternativeIndent>(
			"formatting.alternativeIndent",
			"align",
		),
		insertFinalNewline: readGrammarConfig<boolean>(
			"formatting.insertFinalNewline",
			true,
		),
		blankLinesBetweenRules: readGrammarConfig<number>(
			"formatting.blankLinesBetweenRules",
			1,
		),
		breakAlternatives: readGrammarConfig<AbnfBreakAlternatives>(
			"formatting.breakAlternatives",
			"always",
		),
		maxLineLength: readGrammarConfig<number>("formatting.maxLineLength", 80),
		preserveContinuationLineBreaks: readGrammarConfig<boolean>(
			"formatting.preserveContinuationLineBreaks",
			false,
		),
		spaceBeforeInlineComment: readGrammarConfig<number>(
			"formatting.spaceBeforeInlineComment",
			2,
		),
		alignProductionNumbers: readGrammarConfig<boolean>(
			"formatting.alignProductionNumbers",
			true,
		),
		preserveCommentSpacing: readGrammarConfig<boolean>(
			"formatting.preserveCommentSpacing",
			true,
		),
		trimTrailingBlankLines: readGrammarConfig<boolean>(
			"formatting.trimTrailingBlankLines",
			true,
		),
	};
}
