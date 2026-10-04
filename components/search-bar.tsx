'use client';

import type { FormEventHandler, Ref } from 'react';
import { Icon } from '@/components/icon';
import { Select } from '@/components/select';
import { locations, workTypes } from '@/features/jobs/types';

type SearchValues = { q: string; location: string; workType: string };

type Props = {
	action?: string;
	inputType?: 'text' | 'search';
	initialValues?: SearchValues;
	formRef?: Ref<HTMLFormElement>;
	onSubmit?: FormEventHandler<HTMLFormElement>;
};

export function SearchBar({ action, inputType = 'text', initialValues, formRef, onSubmit }: Props) {
	return (
		<form
			ref={formRef}
			className='search-bar'
			action={action}
			method='get'
			role='search'
			aria-label='Search jobs'
			onSubmit={onSubmit}>
			<label className='search-input'>
				<Icon name='search' size={22} />
				<span className='sr-only'>Job title, company, or keyword</span>
				<input
					key={initialValues?.q}
					name='q'
					type={inputType}
					defaultValue={initialValues?.q}
					placeholder='Job title, company, or keyword'
					maxLength={150}
				/>
			</label>
			<label className='search-select'>
				<Icon name='globe' size={19} />
				<span className='sr-only'>Search location</span>
				<Select
					key={initialValues?.location}
					name='location'
					aria-label='Search location'
					defaultValue={initialValues?.location}>
					<option value=''>Anywhere</option>
					{locations.map((value) => (
						<option key={value}>{value}</option>
					))}
				</Select>
				<Icon name='down' size={14} />
			</label>
			<label className='search-select search-work'>
				<Icon name='briefcase' size={18} />
				<span className='sr-only'>Search work arrangement</span>
				<Select
					key={initialValues?.workType}
					name='workType'
					aria-label='Search work arrangement'
					defaultValue={initialValues?.workType}>
					<option value=''>Any work type</option>
					{workTypes.map((value) => (
						<option key={value}>{value}</option>
					))}
				</Select>
				<Icon name='down' size={14} />
			</label>
			<button className='primary-button search-button' type='submit'>
				Search jobs <Icon name='arrow' size={18} />
			</button>
		</form>
	);
}
