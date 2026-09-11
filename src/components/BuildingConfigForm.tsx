import { FormEvent, useState } from 'react';
import {
  BuildingConfig,
  BuildingType,
  OperatingDay,
  buildingTypes,
  operatingDays,
} from '../types/buildingConfig';

type BuildingConfigFormValues = {
  buildingName: string;
  buildingType: '' | BuildingType;
  electricityRate: string;
  normalOperatingDays: OperatingDay[];
};

type BuildingConfigFormErrors = Partial<Record<keyof BuildingConfigFormValues, string>>;

type BuildingConfigFormProps = {
  initialConfig?: BuildingConfig | null;
  onSubmit: (config: BuildingConfig) => void;
};

const createInitialValues = (
  initialConfig?: BuildingConfig | null,
): BuildingConfigFormValues => ({
  buildingName: initialConfig?.buildingName ?? '',
  buildingType: initialConfig?.buildingType ?? '',
  electricityRate:
    initialConfig?.electricityRate === undefined
      ? ''
      : String(initialConfig.electricityRate),
  normalOperatingDays: initialConfig?.normalOperatingDays ?? [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
  ],
});

const validateForm = (
  values: BuildingConfigFormValues,
): { errors: BuildingConfigFormErrors; config?: BuildingConfig } => {
  const errors: BuildingConfigFormErrors = {};
  const trimmedBuildingName = values.buildingName.trim();
  const electricityRate = Number(values.electricityRate);

  if (!trimmedBuildingName) {
    errors.buildingName = 'Enter a building name.';
  }

  if (!values.buildingType) {
    errors.buildingType = 'Select a building type.';
  }

  if (!values.electricityRate.trim()) {
    errors.electricityRate = 'Enter an electricity rate.';
  } else if (!Number.isFinite(electricityRate) || electricityRate < 0) {
    errors.electricityRate = 'Enter a rate of 0 or greater.';
  }

  if (values.normalOperatingDays.length === 0) {
    errors.normalOperatingDays = 'Select at least one operating day.';
  }

  if (Object.keys(errors).length > 0 || !values.buildingType) {
    return { errors };
  }

  return {
    errors,
    config: {
      buildingName: trimmedBuildingName,
      buildingType: values.buildingType,
      electricityRate,
      normalOperatingDays: values.normalOperatingDays,
    },
  };
};

function BuildingConfigForm({ initialConfig, onSubmit }: BuildingConfigFormProps) {
  const [values, setValues] = useState<BuildingConfigFormValues>(() =>
    createInitialValues(initialConfig),
  );
  const [errors, setErrors] = useState<BuildingConfigFormErrors>({});

  const fieldErrorId = (field: keyof BuildingConfigFormValues) =>
    errors[field] ? `${field}-error` : undefined;

  const updateDaySelection = (day: OperatingDay) => {
    setValues((currentValues) => {
      const isSelected = currentValues.normalOperatingDays.includes(day);
      return {
        ...currentValues,
        normalOperatingDays: isSelected
          ? currentValues.normalOperatingDays.filter((selectedDay) => selectedDay !== day)
          : [...currentValues.normalOperatingDays, day],
      };
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const result = validateForm(values);
    setErrors(result.errors);

    if (result.config) {
      onSubmit(result.config);
    }
  };

  return (
    <form className="building-config-form" noValidate onSubmit={handleSubmit}>
      <div className="form-field">
        <label htmlFor="buildingName">Building name</label>
        <input
          aria-describedby={fieldErrorId('buildingName')}
          aria-invalid={Boolean(errors.buildingName)}
          id="buildingName"
          name="buildingName"
          onChange={(event) =>
            setValues((currentValues) => ({
              ...currentValues,
              buildingName: event.target.value,
            }))
          }
          type="text"
          value={values.buildingName}
        />
        {errors.buildingName && (
          <p className="field-error" id="buildingName-error">
            {errors.buildingName}
          </p>
        )}
      </div>

      <div className="form-field">
        <label htmlFor="buildingType">Building type</label>
        <select
          aria-describedby={fieldErrorId('buildingType')}
          aria-invalid={Boolean(errors.buildingType)}
          id="buildingType"
          name="buildingType"
          onChange={(event) =>
            setValues((currentValues) => ({
              ...currentValues,
              buildingType: event.target.value as BuildingConfigFormValues['buildingType'],
            }))
          }
          value={values.buildingType}
        >
          <option value="">Select a type</option>
          {buildingTypes.map((buildingType) => (
            <option key={buildingType} value={buildingType}>
              {buildingType}
            </option>
          ))}
        </select>
        {errors.buildingType && (
          <p className="field-error" id="buildingType-error">
            {errors.buildingType}
          </p>
        )}
      </div>

      <div className="form-field">
        <label htmlFor="electricityRate">Electricity rate ($/kWh)</label>
        <input
          aria-describedby={fieldErrorId('electricityRate')}
          aria-invalid={Boolean(errors.electricityRate)}
          id="electricityRate"
          min="0"
          name="electricityRate"
          onChange={(event) =>
            setValues((currentValues) => ({
              ...currentValues,
              electricityRate: event.target.value,
            }))
          }
          step="0.0001"
          type="number"
          value={values.electricityRate}
        />
        {errors.electricityRate && (
          <p className="field-error" id="electricityRate-error">
            {errors.electricityRate}
          </p>
        )}
      </div>

      <fieldset
        aria-describedby={fieldErrorId('normalOperatingDays')}
        className="form-field day-fieldset"
      >
        <legend>Normal operating days</legend>
        <div className="day-options">
          {operatingDays.map((day) => (
            <label className="day-option" key={day}>
              <input
                checked={values.normalOperatingDays.includes(day)}
                onChange={() => updateDaySelection(day)}
                type="checkbox"
              />
              <span>{day.slice(0, 3)}</span>
            </label>
          ))}
        </div>
        {errors.normalOperatingDays && (
          <p className="field-error" id="normalOperatingDays-error">
            {errors.normalOperatingDays}
          </p>
        )}
      </fieldset>

      <button type="submit">Save building setup</button>
    </form>
  );
}

export default BuildingConfigForm;
