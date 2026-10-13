'use client';
import {
	useEffect,
	useRef,
	useState,
	useTransition,
	useOptimistic,
	useSyncExternalStore,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { SearchBar } from '@/components/search-bar';
import { Select } from '@/components/select';
import { Icon } from '@/components/icon';
import { JobCard } from './job-card';
import { JobFilters } from './job-filters';
import {
	activeFilterCount,
	PAGE_SIZE,
	parseFilters,
	serializeFilters,
	sortOptions,
} from './filter-jobs';
import { type Filters, type Job } from './types';
import type { PageResult } from '@/lib/api';
import { pageNumbers } from '@/lib/api-query';
import { JobSkeleton } from '@/components/job-skeleton';
import { activity } from '@/lib/analytics-client';

const quickFilters: {
	label: string;
	patch: Partial<Filters>;
	field: keyof Filters;
	value: string;
}[] = [
	...[
		'Frontend',
		'Backend',
		'Full Stack',
		'QA',
		'DevOps',
		'Design',
		'Product',
		'Data',
		'AI / ML',
		'Sales',
		'Marketing',
		'Construction & Trades',
		'Manufacturing & Production',
		'Logistics & Supply Chain',
		'Healthcare',
		'Retail & Hospitality',
	].map((category) => ({
		label: category,
		patch: { category },
		field: 'category' as const,
		value: category,
	})),
];
const JOBS_VIEW_KEY = 'vmiyou:jobs-view';
const JOBS_VIEW_EVENT = 'vmiyou:jobs-view-change';
const NARROW_JOBS_VIEW = '(max-width: 767.98px)';
type JobsView = 'grid' | 'list';
let fallbackView: JobsView = 'grid';
function getJobsView(): JobsView {
	if (window.matchMedia(NARROW_JOBS_VIEW).matches) return 'grid';
	try {
		return window.localStorage.getItem(JOBS_VIEW_KEY) === 'list' ? 'list' : 'grid';
	} catch {
		return fallbackView;
	}
}
function subscribeJobsView(callback: () => void) {
	const narrowViewport = window.matchMedia(NARROW_JOBS_VIEW);
	window.addEventListener('storage', callback);
	window.addEventListener(JOBS_VIEW_EVENT, callback);
	narrowViewport.addEventListener('change', callback);
	return () => {
		window.removeEventListener('storage', callback);
		window.removeEventListener(JOBS_VIEW_EVENT, callback);
		narrowViewport.removeEventListener('change', callback);
	};
}
function getServerJobsView(): JobsView {
	return 'grid';
}
export function JobsExplorer({
	result,
	error,
	appliedQuery,
	now,
}: {
	result: PageResult<Job> | null;
	error: string;
	appliedQuery: string;
	now: number;
}) {
	const pathname = usePathname();
	const router = useRouter();
	const [pending, startTransition] = useTransition();
	const view = useSyncExternalStore(subscribeJobsView, getJobsView, getServerJobsView);
	function changeView(next: JobsView) {
		fallbackView = next;
		try {
			window.localStorage.setItem(JOBS_VIEW_KEY, next);
		} catch {
			// The selected view still works for this visit when storage is disabled.
		}
		window.dispatchEvent(new Event(JOBS_VIEW_EVENT));
	}
	const [filters, setOptimisticFilters] = useOptimistic(
		parseFilters(new URLSearchParams(appliedQuery)),
	);
	const quickCategories = useRef<HTMLDivElement>(null);
	const quickScrollTrack = useRef<HTMLDivElement>(null);
	const quickDrag = useRef<{ pointerId: number; offset: number } | null>(null);
	const [quickScroll, setQuickScroll] = useState({ overflow: false, fraction: 1, progress: 0 });
	useEffect(() => {
		const list = quickCategories.current;
		if (!list) return;
		function syncScroll() {
			if (!list) return;
			const remaining = list.scrollWidth - list.clientWidth;
			const next = {
				overflow: remaining > 1,
				fraction: Math.min(1, list.clientWidth / list.scrollWidth),
				progress: remaining > 1 ? list.scrollLeft / remaining : 0,
			};
			setQuickScroll((current) => current.overflow === next.overflow && current.fraction === next.fraction && current.progress === next.progress ? current : next);
		}
		const observer = new ResizeObserver(syncScroll);
		observer.observe(list);
		for (const child of list.children) observer.observe(child);
		list.addEventListener('scroll', syncScroll, { passive: true });
		syncScroll();
		return () => {
			observer.disconnect();
			list.removeEventListener('scroll', syncScroll);
		};
	}, []);
	function moveQuickScroll(clientX: number, offset: number) {
		const list = quickCategories.current;
		const track = quickScrollTrack.current;
		if (!list || !track) return;
		const rect = track.getBoundingClientRect();
		const remaining = list.scrollWidth - list.clientWidth;
		const travel = rect.width * (1 - list.clientWidth / list.scrollWidth);
		if (remaining <= 0 || travel <= 0) return;
		const position = Math.max(0, Math.min(travel, clientX - rect.left - offset));
		list.scrollLeft = (position / travel) * remaining;
	}
	const dialog = useRef<HTMLDialogElement>(null);
	const filterTrigger = useRef<HTMLButtonElement>(null);
	const searchForm = useRef<HTMLFormElement>(null);
	const resultHeading = useRef<HTMLHeadingElement>(null);
	const [draft, setDraft] = useState(filters);
	const [drawerOpen, setDrawerOpen] = useState(false);
	const [preview, setPreview] = useState<{
		query: string;
		total: number | null;
	} | null>(null);
	const draftQuery = serializeFilters({ ...draft, page: 1 }).toString();
	useEffect(() => {
		if (!drawerOpen) return;
		const controller = new AbortController();
		const timer = setTimeout(async () => {
			try {
				const response = await fetch(`/api/jobs/count?${draftQuery}`, {
					signal: controller.signal,
				});
				if (!response.ok) throw new Error('Count unavailable');
				const data: { total: number } = await response.json();
				if (!controller.signal.aborted)
					setPreview({ query: draftQuery, total: data.total });
			} catch {
				if (!controller.signal.aborted)
					setPreview({ query: draftQuery, total: null });
			}
		}, 200);
		return () => {
			clearTimeout(timer);
			controller.abort();
		};
	}, [drawerOpen, draftQuery]);
	const pages = Math.max(1, result?.pages ?? 1);
	const page = result?.page ?? filters.page;
	const visible = result?.items ?? [];
	const total = result?.total ?? 0;
	const count = activeFilterCount({ ...filters, location: '', workType: '' });
	const query = appliedQuery;
	function update(patch: Partial<Filters>) {
		if (patch.page === undefined) activity('FILTER');
		if (patch.q !== undefined && patch.q !== filters.q && patch.sort === undefined) {
			patch = { ...patch, sort: patch.q ? (filters.sort === 'newest' ? 'relevance' : filters.sort) : (filters.sort === 'relevance' ? 'newest' : filters.sort) };
		}
		const nextFilters = parseFilters(
			serializeFilters({ ...filters, ...patch, page: patch.page ?? 1 }),
		);
		const next = serializeFilters(nextFilters).toString();
		startTransition(() => {
			setOptimisticFilters(nextFilters);
			router.push(`${pathname}${next ? `?${next}` : ''}`, { scroll: false });
		});
	}
	function reset() {
		searchForm.current?.reset();
		update(parseFilters(new URLSearchParams()));
	}
	function goToPage(next: number) {
		update({ page: next });
		resultHeading.current?.focus({ preventScroll: true });
		document
			.getElementById('results')
			?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}
	function pageHref(next: number) {
		const params = serializeFilters({ ...filters, page: next }).toString();
		return `/jobs${params ? `?${params}` : ''}`;
	}
	const activeChips: { label: string; patch: Partial<Filters> }[] = [
		...(filters.q ? [{ label: `“${filters.q}”`, patch: { q: '' } }] : []),
		...(['category', 'location', 'workType', 'experience', 'employmentKind', 'place', 'companyName', 'currency'] as const)
			.filter((key) => filters[key])
			.map((key) => ({
				label: filters[key],
				patch: {
					[key]: '',
					...(key === 'currency'
						? {
								salaryMin: '',
								salaryMax: '',
								sort: filters.sort.startsWith('salary')
									? 'newest'
									: filters.sort,
							}
						: {}),
				},
			})),
		...(filters.posted
			? [
					{
						label:
							filters.posted === '1'
								? 'Last 24 hours'
								: `Last ${filters.posted} days`,
						patch: { posted: '' },
					},
				]
			: []),
		...(filters.salaryMin
			? [
					{
						label: `From ${Number(filters.salaryMin).toLocaleString('en-US')}`,
						patch: { salaryMin: '' },
					},
				]
			: []),
		...(filters.salaryMax
			? [
					{
						label: `Up to ${Number(filters.salaryMax).toLocaleString('en-US')}`,
						patch: { salaryMax: '' },
					},
				]
			: []),
		...filters.tech.map((tech) => ({
			label: tech,
			patch: { tech: filters.tech.filter((value) => value !== tech) },
		})),
	];
	return (
		<>
			<section className="search-section" aria-label="Search jobs">
				<div className="container search-inner">
					<div className="search-heading">
						<h1>Find your next job in your area</h1>
						<p>Opportunities from company career pages. Your next move.</p>
					</div>
					<SearchBar
						formRef={searchForm}
						initialValues={{
							q: filters.q,
							location: filters.location,
							workType: filters.workType,
						}}
						onSubmit={(event) => {
							event.preventDefault();
							const data = new FormData(event.currentTarget);
							update({
								q: String(data.get('q') || '').trim(),
								location: String(data.get('location') || ''),
								workType: String(data.get('workType') || ''),
							});
						}}
					/>
				</div>
			</section>
			<div className="category-bar">
				<div className="container quick-categories">
					<div
						ref={quickCategories}
						id="quick-categories-list"
						className="quick-filters"
						role="group"
						aria-label="Quick categories"
					>
						{quickFilters.map((item) => (
							<button
								key={item.label}
								type="button"
								aria-pressed={filters[item.field] === item.value}
								className={
									filters[item.field] === item.value
										? 'quick-chip active'
										: 'quick-chip'
								}
								onClick={() =>
									update(
										filters[item.field] === item.value
											? { [item.field]: '' }
											: item.patch,
									)
								}
							>
								{item.label}
							</button>
						))}
					</div>
					<div
						ref={quickScrollTrack}
						className="quick-scroll-track"
						role="scrollbar"
						aria-label="Scroll quick categories"
						aria-controls="quick-categories-list"
						aria-orientation="horizontal"
						aria-valuemin={0}
						aria-valuemax={100}
						aria-valuenow={Math.round(quickScroll.progress * 100)}
						tabIndex={quickScroll.overflow ? 0 : -1}
						hidden={!quickScroll.overflow}
						onPointerDown={(event) => {
							if (event.pointerType === 'mouse' && event.button !== 0 && event.button !== 2) return;
							if (event.button === 2) event.preventDefault();
							const track = quickScrollTrack.current;
							if (!track) return;
							const rect = track.getBoundingClientRect();
							const thumbWidth = rect.width * quickScroll.fraction;
							const thumbLeft = rect.width * (1 - quickScroll.fraction) * quickScroll.progress;
							const pointerX = event.clientX - rect.left;
							const offset = pointerX >= thumbLeft && pointerX <= thumbLeft + thumbWidth ? pointerX - thumbLeft : thumbWidth / 2;
							quickDrag.current = { pointerId: event.pointerId, offset };
							track.setPointerCapture(event.pointerId);
							moveQuickScroll(event.clientX, offset);
						}}
						onPointerMove={(event) => {
							if (quickDrag.current?.pointerId === event.pointerId) moveQuickScroll(event.clientX, quickDrag.current.offset);
						}}
						onPointerUp={(event) => {
							if (quickDrag.current?.pointerId === event.pointerId) quickDrag.current = null;
						}}
						onPointerCancel={() => { quickDrag.current = null; }}
						onContextMenu={(event) => event.preventDefault()}
						onKeyDown={(event) => {
							const list = quickCategories.current;
							if (!list) return;
							if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
								event.preventDefault();
								list.scrollBy({ left: (event.key === 'ArrowRight' ? 1 : -1) * Math.max(80, list.clientWidth / 3), behavior: 'smooth' });
							} else if (event.key === 'Home' || event.key === 'End') {
								event.preventDefault();
								list.scrollTo({ left: event.key === 'Home' ? 0 : list.scrollWidth });
							}
						}}
					>
						<span className="quick-scroll-thumb" style={{ width: `${quickScroll.fraction * 100}%`, left: `${quickScroll.progress * (1 - quickScroll.fraction) * 100}%` }} />
					</div>
				</div>
			</div>
			<main id="main-content" className="container results-layout">
				<aside className="desktop-filters" aria-label="Job filters">
					<JobFilters filters={filters} onChange={update} />
					<div className="filter-note">
						<Icon name="globe" size={19} />
						<p>
							<strong>Remote has a location, too.</strong> Check where each
							company can hire before you apply.
						</p>
					</div>
				</aside>
				<section className="results" id="results" aria-label="Job results">
					<div className="results-toolbar">
						<div>
							<h2 ref={resultHeading} tabIndex={-1} aria-live="polite">
								{pending ? (
									'Searching…'
								) : error ? (
									'Jobs unavailable'
								) : (
									<>
										{total} <span>{total === 1 ? 'job' : 'jobs'} found</span>
									</>
								)}
							</h2>
						</div>
						<div className="results-actions">
							<label className="sort-control">
								<span className="sort-label" aria-hidden="true">
									Sort by
								</span>
								<span className="sr-only">Sort jobs</span>
								<Select
									aria-label="Sort jobs"
									value={filters.sort}
									onChange={(value) =>
										update({
											sort: value,
											...(value.startsWith('salary') && !filters.currency
												? { currency: 'USD' }
												: {}),
										})
									}
								>
									{sortOptions.map(([value, label]) => (
										<option key={value} value={value}>
											{label}
										</option>
									))}
								</Select>
								<Icon name="down" size={14} />
							</label>
							<div className="view-switch" role="group" aria-label="Job view">
								<button type="button" aria-pressed={view === 'grid'} onClick={() => changeView('grid')}>
									<Icon name="layoutGrid" size={17} strokeWidth={1.8} />
									Grid
								</button>
								<button type="button" aria-pressed={view === 'list'} onClick={() => changeView('list')}>
									<Icon name="list" size={17} strokeWidth={1.8} />
									List
								</button>
							</div>
						</div>
					</div>
					<div className="results-subline">
						<p aria-live="polite" role="status">
							{filters.q
								? `Results for “${filters.q}”`
								: 'Jobs across industries, in one place'}
						</p>
						<span className="demo-label">
							<span className="tiny-dot" />
							Company listings
						</span>
					</div>
					<button
						ref={filterTrigger}
						type="button"
						className="mobile-filter-button"
						onClick={() => {
							setDraft(filters);
							setDrawerOpen(true);
							dialog.current?.showModal();
						}}
					>
						<Icon name="filters" size={17} />
						Filters{count > 0 && <span>{count}</span>}
						<Icon name="down" size={15} />
					</button>
					{activeChips.length > 0 && (
						<div className="active-filters">
							{activeChips.map((chip, index) => (
								<button
									type="button"
									key={`${chip.label}-${index}`}
									onClick={() => update(chip.patch)}
									aria-label={`Remove ${chip.label} filter`}
								>
									{chip.label}
									<Icon name="close" size={12} />
								</button>
							))}
							<button type="button" className="clear-filters" onClick={reset}>
								Clear all
							</button>
						</div>
					)}
					{filters.sort.startsWith('salary') && (
						<p className="sort-note">
							Showing published salaries in {filters.currency}. All amounts are
							per year.
						</p>
					)}
					{pending ? (
						<JobSkeleton />
					) : error ? (
						<div className="empty-state" role="alert">
							<h3>Let’s try that again.</h3>
							<p>{error}</p>
							<button
								className="primary-button"
								type="button"
								onClick={() => startTransition(() => router.refresh())}
							>
								Try again
							</button>
						</div>
					) : (
						<div className={`job-list${view === 'grid' ? ' job-list-grid' : ''}`}>
							{visible.map((job) => (
								<JobCard key={job.id} job={job} now={now} returnQuery={query} variant={view} />
							))}
						</div>
					)}
					{!pending && !error && total === 0 && (
						<div className="empty-state">
							<span>
								<Icon name="search" size={28} />
							</span>
							<h3>A fresh search might open a door.</h3>
							<p>
								No roles match this combination yet. Try a broader keyword or
								remove a filter.
							</p>
							<button className="primary-button" type="button" onClick={reset}>
								Explore all jobs <Icon name="arrow" size={17} />
							</button>
						</div>
					)}
					{!pending && !error && total > 0 && (
						<div className="pagination">
							<p>
								Showing {(page - 1) * PAGE_SIZE + 1}–
								{Math.min(page * PAGE_SIZE, total)} of {total} jobs
							</p>
							{pages > 1 && (
								<nav aria-label="Pagination">
									{page === 1 ? <button type="button" aria-label="Previous page" disabled><Icon name="chevron" style={{ transform: 'rotate(180deg)' }} size={15} /></button> : <Link className="pagination-link" href={pageHref(page - 1)} aria-label="Previous page" onClick={(event) => { event.preventDefault(); goToPage(page - 1); }}>
										<Icon
											name="chevron"
											style={{ transform: 'rotate(180deg)' }}
											size={15}
										/>
									</Link>}
									{pageNumbers(page, pages).map((number) => (
										<Link
											className={`pagination-link ${number === page ? 'current' : ''}`}
											href={pageHref(number)}
											key={number}
											aria-label={`Page ${number}`}
											aria-current={number === page ? 'page' : undefined}
											onClick={(event) => { event.preventDefault(); goToPage(number); }}
										>
											{number}
										</Link>
									))}
									{page === pages ? <button type="button" aria-label="Next page" disabled><Icon name="chevron" size={15} /></button> : <Link className="pagination-link" href={pageHref(page + 1)} aria-label="Next page" onClick={(event) => { event.preventDefault(); goToPage(page + 1); }}>
										<Icon name="chevron" size={15} />
									</Link>}
								</nav>
							)}
						</div>
					)}
					<div className="demo-notice">
						<Icon name="sparkle" size={17} />
						<p>
							Listings come from company career pages. Check the original
							listing for current availability and hiring requirements.
						</p>
					</div>
				</section>
			</main>
			<dialog
				ref={dialog}
				className="filter-dialog"
				aria-labelledby="filter-dialog-title"
				onClose={() => {
					setDrawerOpen(false);
					filterTrigger.current?.focus({ preventScroll: true });
				}}
				onClick={(event) => {
					if (event.target === event.currentTarget) dialog.current?.close();
				}}
			>
				<div className="dialog-top">
					<h2 id="filter-dialog-title">Filter jobs</h2>
					<button
						type="button"
						className="icon-button"
						aria-label="Close filters"
						onClick={() => dialog.current?.close()}
					>
						<Icon name="close" />
					</button>
				</div>
				<div className="dialog-body">
					<JobFilters
						filters={draft}
						onChange={(patch) =>
							setDraft((current) => ({ ...current, ...patch }))
						}
						onReset={() => {
							setDraft(parseFilters(new URLSearchParams()));
							reset();
						}}
					/>
				</div>
				<div className="dialog-bottom">
					<button
						type="button"
						className="primary-button"
						onClick={() => {
							update({ ...draft, page: 1 });
							dialog.current?.close();
						}}
					>
						Show{' '}
						{preview?.query === draftQuery && preview.total !== null
							? preview.total
							: 'matching'}{' '}
						jobs <Icon name="arrow" size={18} />
					</button>
				</div>
			</dialog>
		</>
	);
}
