'use client';

import Link from 'next/link';
import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';

type TitleLine = { left: number; top: number; width: number };

export function ResultJobTitle({ href, title }: { href: string; title: string }) {
	const headingRef = useRef<HTMLHeadingElement>(null);
	const textRef = useRef<HTMLSpanElement>(null);
	const [lines, setLines] = useState<TitleLine[]>([]);

	useLayoutEffect(() => {
		const heading = headingRef.current;
		const text = textRef.current;
		if (!heading || !text) return;

		let frame = 0;
		let active = true;
		const measure = () => {
			const headingRect = heading.getBoundingClientRect();
			const range = document.createRange();
			range.selectNodeContents(text);
			const fragments = Array.from(range.getClientRects());
			range.detach();

			const next: TitleLine[] = [];
			for (const rect of fragments) {
				if (!rect.width) continue;
				const previous = next.at(-1);
				if (previous && Math.abs(previous.top - (rect.bottom - headingRect.top + 1)) < 1) {
					const right = Math.max(previous.left + previous.width, rect.right - headingRect.left);
					previous.left = Math.min(previous.left, rect.left - headingRect.left);
					previous.width = right - previous.left;
				} else {
					next.push({
						left: rect.left - headingRect.left,
						top: rect.bottom - headingRect.top + 1,
						width: rect.width,
					});
				}
			}
			setLines((current) =>
				current.length === next.length &&
				current.every(
					(line, index) =>
						Math.abs(line.left - next[index].left) < 0.1 &&
						Math.abs(line.top - next[index].top) < 0.1 &&
						Math.abs(line.width - next[index].width) < 0.1
				)
					? current
					: next
			);
		};
		const scheduleMeasure = () => {
			if (!active) return;
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(measure);
		};

		measure();
		const observer = new ResizeObserver(scheduleMeasure);
		observer.observe(heading);
		window.addEventListener('resize', scheduleMeasure);
		document.fonts?.addEventListener('loadingdone', scheduleMeasure);
		void document.fonts?.ready.then(scheduleMeasure);
		return () => {
			active = false;
			cancelAnimationFrame(frame);
			observer.disconnect();
			window.removeEventListener('resize', scheduleMeasure);
			document.fonts?.removeEventListener('loadingdone', scheduleMeasure);
		};
	}, [title]);

	const lineDuration = lines.length ? 560 / lines.length : 560;

	return (
		<h3 ref={headingRef}>
			<Link href={href} className='card-title-link' title={title}>
				<span ref={textRef}>{title}</span>
			</Link>
			<span className='job-title-lines' aria-hidden='true'>
				{lines.map((line, index) => (
					<span
						key={index}
						className='job-title-line'
						style={
							{
								left: line.left,
								top: line.top,
								width: line.width,
								'--line-duration': `${lineDuration}ms`,
								'--line-enter-delay': `${index * lineDuration}ms`,
								'--line-exit-delay': `${(lines.length - 1 - index) * lineDuration}ms`,
							} as CSSProperties
						}
					/>
				))}
			</span>
		</h3>
	);
}
