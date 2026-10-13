'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

export function HorizontalScroller({
	children,
	className,
	label,
}: {
	children: ReactNode;
	className: string;
	label: string;
}) {
	const scrollerRef = useRef<HTMLDivElement>(null);
	const dragRef = useRef({ pointerId: -1, startX: 0, scrollLeft: 0, moved: false });
	const suppressClick = useRef(false);
	const [dragging, setDragging] = useState(false);
	const [scroll, setScroll] = useState({ overflow: false, fraction: 1, progress: 0 });

	useEffect(() => {
		const scroller = scrollerRef.current;
		if (!scroller) return;
		const sync = () => {
			const remaining = scroller.scrollWidth - scroller.clientWidth;
			const next = {
				overflow: remaining > 1,
				fraction: Math.min(1, scroller.clientWidth / scroller.scrollWidth),
				progress: remaining > 1 ? scroller.scrollLeft / remaining : 0,
			};
			setScroll((current) =>
				current.overflow === next.overflow &&
				current.fraction === next.fraction &&
				current.progress === next.progress
					? current
					: next,
			);
		};
		const observer = new ResizeObserver(sync);
		observer.observe(scroller);
		for (const child of scroller.children) observer.observe(child);
		scroller.addEventListener('scroll', sync, { passive: true });
		sync();
		return () => {
			observer.disconnect();
			scroller.removeEventListener('scroll', sync);
		};
	}, []);

	function finishDrag(pointerId: number) {
		if (dragRef.current.pointerId !== pointerId) return;
		const moved = dragRef.current.moved;
		dragRef.current.pointerId = -1;
		setDragging(false);
		if (moved) {
			suppressClick.current = true;
			window.setTimeout(() => {
				suppressClick.current = false;
			}, 0);
		}
	}

	return (
		<>
			<div
				ref={scrollerRef}
				className={`${className} horizontal-scroller${scroll.overflow ? ' can-scroll' : ''}${dragging ? ' is-dragging' : ''}`}
				aria-label={label}
				tabIndex={scroll.overflow ? 0 : -1}
				onDragStart={(event) => event.preventDefault()}
				onPointerDown={(event) => {
					if (event.pointerType !== 'mouse' || event.button !== 0 || !scroll.overflow) return;
					dragRef.current = {
						pointerId: event.pointerId,
						startX: event.clientX,
						scrollLeft: event.currentTarget.scrollLeft,
						moved: false,
					};
				}}
				onPointerMove={(event) => {
					const drag = dragRef.current;
					if (drag.pointerId !== event.pointerId) return;
					const distance = event.clientX - drag.startX;
					if (!drag.moved && Math.abs(distance) > 4) {
						drag.moved = true;
						event.currentTarget.setPointerCapture(event.pointerId);
						setDragging(true);
					}
					if (!drag.moved) return;
					event.preventDefault();
					event.currentTarget.scrollLeft = drag.scrollLeft - distance;
				}}
				onPointerUp={(event) => finishDrag(event.pointerId)}
				onPointerCancel={(event) => finishDrag(event.pointerId)}
				onKeyDown={(event) => {
					if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
					event.preventDefault();
					event.currentTarget.scrollBy({
						left: (event.key === 'ArrowRight' ? 1 : -1) * event.currentTarget.clientWidth * 0.8,
						behavior: 'smooth',
					});
				}}
				onClickCapture={(event) => {
					if (!suppressClick.current) return;
					event.preventDefault();
					event.stopPropagation();
				}}
			>
				{children}
			</div>
			<div className='horizontal-scroll-feedback' hidden={!scroll.overflow}>
				<span className='horizontal-scroll-hint'>
					<span className='horizontal-scroll-hint-touch'>Swipe to explore</span>
					<span className='horizontal-scroll-hint-mouse'>Drag to explore</span>
				</span>
				<span className='horizontal-scroll-track' aria-hidden='true'>
					<span
						className='horizontal-scroll-thumb'
						style={{
							width: `${scroll.fraction * 100}%`,
							left: `${scroll.progress * (1 - scroll.fraction) * 100}%`,
						}}
					/>
				</span>
			</div>
		</>
	);
}
