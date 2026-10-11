"use client";
import { useId, type ReactNode } from "react";
import {
  categories,
  currencies,
  experiences,
  employmentKinds,
  technologies,
  supportsTechnologyFilter,
  type Filters,
} from "./types";
import { activeFilterCount, postedOptions } from "./filter-jobs";
import { Select } from "@/components/select";
import { Icon } from "@/components/icon";
export type FilterChange = (patch: Partial<Filters>) => void;

function FilterSection({
  title,
  selected = 0,
  children,
}: {
  title: string;
  selected?: number;
  children: ReactNode;
}) {
  return (
    <details className="filter-section" open>
      <summary>
        {title}
        {selected > 0 && <span className="filter-count">{selected}</span>}
        <Icon name="down" size={15} />
      </summary>
      <div className="filter-section-body">{children}</div>
    </details>
  );
}

export function JobFilters({
  filters,
  onChange,
  onReset,
}: {
  filters: Filters;
  onChange: FilterChange;
  onReset?: () => void;
}) {
  const id = useId();
  const count = activeFilterCount({ ...filters, location: "", workType: "" });
  return (
    <div className="filter-content">
      <div className="filter-heading">
        {onReset ? (
          <span className="filter-selection-count">
            {count} additional {count === 1 ? "filter" : "filters"} selected
          </span>
        ) : (
          <h2>
            <Icon name="filters" size={19} />
            Filters{count > 0 && <span className="filter-count">{count}</span>}
          </h2>
        )}
        {onReset && (
          <button type="button" onClick={onReset} className="text-button">
            Clear all
          </button>
        )}
      </div>
      <FilterSection
        title="Category"
        selected={Number(Boolean(filters.category))}
      >
        <label className="sr-only" htmlFor={`${id}-category`}>
          Job category
        </label>
        <div className="select-wrap">
          <Select
            id={`${id}-category`}
            value={filters.category}
            onChange={(value) => onChange({
              category: value,
              ...(!supportsTechnologyFilter(value) ? { tech: [] } : {}),
            })}
          >
            <option value="">All categories</option>
            {categories.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </Select>
          <Icon name="down" size={15} />
        </div>
        {!supportsTechnologyFilter(filters.category) && (
          <p className="filter-hint">Technologies are available for technical job categories.</p>
        )}
      </FilterSection>
      <FilterSection title="Company" selected={Number(Boolean(filters.companyName))}>
        <label className="filter-text-label" htmlFor={`${id}-company`}>
          Company name
        </label>
        <input
          id={`${id}-company`}
          className="filter-text-input"
          key={`company-${filters.companyName}`}
          type="search"
          maxLength={100}
          placeholder="Search companies"
          defaultValue={filters.companyName}
          onBlur={(event) => {
            const value = event.target.value.trim();
            if (value !== filters.companyName) onChange({ companyName: value });
          }}
          onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
        />
      </FilterSection>
      <FilterSection title="City or region" selected={Number(Boolean(filters.place))}>
        <label className="filter-text-label" htmlFor={`${id}-place`}>
          City, region or country
        </label>
        <input
          id={`${id}-place`}
          className="filter-text-input"
          key={`place-${filters.place}`}
          type="search"
          maxLength={100}
          placeholder="e.g. Berlin or Germany"
          defaultValue={filters.place}
          onBlur={(event) => {
            const value = event.target.value.trim();
            if (value !== filters.place) onChange({ place: value });
          }}
          onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
        />
      </FilterSection>
      <FilterSection title="Employment type" selected={Number(Boolean(filters.employmentKind))}>
        <label className="sr-only" htmlFor={`${id}-employment`}>Employment type</label>
        <div className="select-wrap">
          <Select
            id={`${id}-employment`}
            value={filters.employmentKind}
            onChange={(value) => onChange({ employmentKind: value })}
          >
            <option value="">Any employment type</option>
            {employmentKinds.map((value) => <option key={value}>{value}</option>)}
          </Select>
          <Icon name="down" size={15} />
        </div>
      </FilterSection>
      <FilterSection
        title="Experience"
        selected={Number(Boolean(filters.experience))}
      >
        <fieldset className="filter-group">
          <legend className="sr-only">Experience level</legend>
          <div className="experience-options">
            {experiences.map((experience) => (
              <button
                key={experience}
                type="button"
                className={filters.experience === experience ? "selected" : ""}
                aria-pressed={filters.experience === experience}
                onClick={() =>
                  onChange({
                    experience:
                      filters.experience === experience ? "" : experience,
                  })
                }
              >
                {experience}
              </button>
            ))}
          </div>
        </fieldset>
      </FilterSection>
      <FilterSection
        title="Annual salary"
        selected={Number(
          Boolean(filters.salaryMin || filters.salaryMax || filters.currency),
        )}
      >
        <fieldset className="filter-group">
          <legend className="sr-only">Annual salary</legend>
          <div className="salary-inputs">
            <label>
              <span className="sr-only">Minimum annual salary</span>
              <input
                key={`min-${filters.salaryMin}`}
                type="number"
                min="0"
                max="999999999"
                step="1000"
                placeholder="From"
                defaultValue={filters.salaryMin}
                onBlur={(event) =>
                  onChange({
                    salaryMin: event.target.value,
                    currency:
                      filters.currency || (event.target.value ? "USD" : ""),
                  })
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                }}
              />
            </label>
            <span>–</span>
            <label>
              <span className="sr-only">Maximum annual salary</span>
              <input
                key={`max-${filters.salaryMax}`}
                type="number"
                min="0"
                max="999999999"
                step="1000"
                placeholder="To"
                defaultValue={filters.salaryMax}
                onBlur={(event) =>
                  onChange({
                    salaryMax: event.target.value,
                    currency:
                      filters.currency || (event.target.value ? "USD" : ""),
                  })
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                }}
              />
            </label>
          </div>
          <div className="select-wrap salary-currency">
            <Select
              aria-label="Salary currency"
              value={filters.currency}
              onChange={(value) =>
                onChange({
                  currency: value,
                  ...(value
                    ? {}
                    : {
                        salaryMin: "",
                        salaryMax: "",
                        sort: filters.sort.startsWith("salary")
                          ? "newest"
                          : filters.sort,
                      }),
                })
              }
            >
              <option value="">Any currency</option>
              {currencies.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </Select>
            <Icon name="down" size={15} />
          </div>
          <p className="filter-hint">Gross pay. No currency conversion.</p>
          {filters.salaryMin &&
            filters.salaryMax &&
            Number(filters.salaryMin) > Number(filters.salaryMax) && (
              <p className="field-error" role="alert">
                Maximum must be at least the minimum.
              </p>
            )}
        </fieldset>
      </FilterSection>
      {supportsTechnologyFilter(filters.category) && <FilterSection title="Technologies" selected={filters.tech.length}>
        <fieldset className="filter-group">
          <legend className="sr-only">Tech stack</legend>
          <p className="tech-hint">For technical roles. Match all selected technologies.</p>
          <div className="tech-options">
            {technologies.map((tech) => (
              <label className="check-row" key={tech}>
                <input
                  type="checkbox"
                  checked={filters.tech.includes(tech)}
                  onChange={() =>
                    onChange({
                      tech: filters.tech.includes(tech)
                        ? filters.tech.filter((item) => item !== tech)
                        : [...filters.tech, tech],
                    })
                  }
                />
                <span>{tech}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </FilterSection>}
      <FilterSection
        title="Posted date"
        selected={Number(Boolean(filters.posted))}
      >
        <label className="sr-only" htmlFor={`${id}-posted`}>
          Date posted
        </label>
        <div className="select-wrap">
          <Select
            id={`${id}-posted`}
            value={filters.posted}
            onChange={(value) => onChange({ posted: value })}
          >
            <option value="">Any time</option>
            {postedOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Icon name="down" size={15} />
        </div>
      </FilterSection>
    </div>
  );
}
