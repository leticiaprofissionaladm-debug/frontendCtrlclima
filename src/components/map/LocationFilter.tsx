import { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  Globe2,
  MapPin,
  Search,
  LoaderCircle,
  Map,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  buscarPaises,
  buscarEstados,
  buscarCidades,
} from '../../services/locationService';

import type {
  Country,
  StateRegion,
  City,
  SelectedLocation,
} from '../../types/location';

import './map.css';

interface Props {
  onLocationChange: (location: SelectedLocation | null) => void;
}

type ActiveDropdown = 'country' | 'state' | 'city' | null;

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export default function LocationFilter({ onLocationChange }: Props) {
  const { t } = useTranslation();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [countries, setCountries] = useState<Country[]>([]);
  const [states, setStates] = useState<StateRegion[]>([]);
  const [cities, setCities] = useState<City[]>([]);

  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [selectedState, setSelectedState] = useState<StateRegion | null>(null);
  const [selectedCity, setSelectedCity] = useState<City | null>(null);

  const [countrySearch, setCountrySearch] = useState('');
  const [stateSearch, setStateSearch] = useState('');
  const [citySearch, setCitySearch] = useState('');

  const [activeDropdown, setActiveDropdown] = useState<ActiveDropdown>(null);
  const [loadingCountries, setLoadingCountries] = useState(true);
  const [loadingStates, setLoadingStates] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadCountries() {
      try {
        setLoadingCountries(true);
        setError(null);
        const data = await buscarPaises();
        if (!active) return;
        setCountries([...data].sort((a, b) => a.name.localeCompare(b.name)));
      } catch {
        if (active) setError(t('locationFilter.countryLoadError'));
      } finally {
        if (active) setLoadingCountries(false);
      }
    }

    void loadCountries();
    return () => {
      active = false;
    };
  }, [t]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setActiveDropdown(null);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Estados são carregados somente depois da seleção de um país.
  useEffect(() => {
    if (!selectedCountry) {
      setStates([]);
      return;
    }

    let active = true;

    async function loadStates() {
      try {
        setLoadingStates(true);
        setError(null);
        const data = await buscarEstados(
          selectedCountry!.iso2 || selectedCountry!.code,
        );
        if (!active) return;
        setStates([...data].sort((a, b) => a.name.localeCompare(b.name)));
      } catch {
        if (active) {
          setStates([]);
          setError(
            t('locationFilter.stateLoadError', {
              defaultValue: 'Não foi possível carregar os estados deste país.',
            }),
          );
        }
      } finally {
        if (active) setLoadingStates(false);
      }
    }

    void loadStates();
    return () => {
      active = false;
    };
  }, [selectedCountry, t]);

  // A pesquisa de cidades é restrita ao país e ao estado selecionados.
  useEffect(() => {
    if (
      !selectedCountry ||
      !selectedState ||
      citySearch.trim().length < 2
    ) {
      setCities([]);
      setLoadingCities(false);
      return;
    }

    let active = true;
    const timeout = window.setTimeout(async () => {
      try {
        setLoadingCities(true);
        setError(null);
        const data = await buscarCidades(
          selectedCountry.iso2 || selectedCountry.code,
          selectedState.name,
          citySearch.trim(),
        );

        if (!active) return;
        setCities([...data].sort((a, b) => a.name.localeCompare(b.name)));
      } catch {
        if (active) {
          setCities([]);
          setError(t('locationFilter.cityLoadError'));
        }
      } finally {
        if (active) setLoadingCities(false);
      }
    }, 350);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [selectedCountry, selectedState, citySearch, t]);

  const filteredCountries = countries.filter((country) =>
    normalizeText(country.name).includes(normalizeText(countrySearch)),
  );

  const filteredStates = states.filter((state) =>
    normalizeText(state.name).includes(normalizeText(stateSearch)),
  );

  function handleCountrySelect(country: Country) {
    setSelectedCountry(country);
    setSelectedState(null);
    setSelectedCity(null);
    setStates([]);
    setCities([]);
    setCountrySearch('');
    setStateSearch('');
    setCitySearch('');
    setActiveDropdown(null);
    setError(null);

    if (country.latitude != null && country.longitude != null) {
      onLocationChange({
        country,
        state: null,
        city: null,
        latitude: country.latitude,
        longitude: country.longitude,
      });
    } else {
      onLocationChange(null);
    }
  }

  function handleStateSelect(state: StateRegion) {
    if (!selectedCountry) return;

    setSelectedState(state);
    setSelectedCity(null);
    setCities([]);
    setStateSearch('');
    setCitySearch('');
    setActiveDropdown(null);
    setError(null);

    // A seleção do estado restringe a busca de cidades.
    // O mapa e os dados da NASA serão atualizados ao escolher uma cidade.
  }

  function handleCitySelect(city: City) {
    if (!selectedCountry || !selectedState) return;

    if (city.latitude == null || city.longitude == null) {
      setError(
        t('locationFilter.coordinatesUnavailable', {
          defaultValue: 'As coordenadas desta cidade não estão disponíveis.',
        }),
      );
      return;
    }

    setSelectedCity(city);
    setCitySearch('');
    setActiveDropdown(null);
    setError(null);

    onLocationChange({
      country: selectedCountry,
      state: selectedState,
      city,
      latitude: city.latitude,
      longitude: city.longitude,
    });
  }

  return (
    <div className="earthscope-location-filter" ref={wrapperRef}>
      <div className="location-filter-heading">
        <div className="location-filter-icon">
          <Globe2 size={20} />
        </div>
        <div>
          <span className="location-filter-eyebrow">
            {t('locationFilter.eyebrow')}
          </span>
          <h3>{t('locationFilter.title')}</h3>
        </div>
      </div>

      <div className="location-filter-fields">
        <div className="location-field">
          <label>{t('locationFilter.countryLabel')}</label>
          <button
            type="button"
            className={`location-select-trigger ${activeDropdown === 'country' ? 'is-open' : ''}`}
            onClick={() =>
              setActiveDropdown(activeDropdown === 'country' ? null : 'country')
            }
            aria-expanded={activeDropdown === 'country'}
            aria-haspopup="listbox"
          >
            <span className="location-select-value">
              <Globe2 size={17} />
              {loadingCountries
                ? t('locationFilter.loadingCountries')
                : selectedCountry?.name || t('locationFilter.countryPlaceholder')}
            </span>
            {loadingCountries ? (
              <LoaderCircle className="location-spinner" size={17} />
            ) : (
              <ChevronDown size={17} />
            )}
          </button>

          {activeDropdown === 'country' && (
            <div className="location-dropdown">
              <div className="location-search">
                <Search size={16} />
                <input
                  type="text"
                  autoFocus
                  placeholder={t('locationFilter.searchCountry')}
                  value={countrySearch}
                  onChange={(event) => setCountrySearch(event.target.value)}
                />
              </div>
              <ul className="location-options" role="listbox">
                {filteredCountries.length ? (
                  filteredCountries.map((country) => (
                    <li key={country.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={selectedCountry?.id === country.id}
                        className={selectedCountry?.id === country.id ? 'selected' : ''}
                        onClick={() => handleCountrySelect(country)}
                      >
                        <span>{country.flag ? `${country.flag} ` : ''}{country.name}</span>
                        <small>{country.iso2 || country.code}</small>
                      </button>
                    </li>
                  ))
                ) : (
                  <li className="location-empty">
                    {t('locationFilter.noCountries')}
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>

        <div className="location-field">
          <label>
            {t('locationFilter.stateLabel', { defaultValue: 'Estado' })}
          </label>
          <button
            type="button"
            className={`location-select-trigger ${!selectedCountry || loadingStates ? 'is-disabled' : ''} ${activeDropdown === 'state' ? 'is-open' : ''}`}
            disabled={!selectedCountry || loadingStates}
            onClick={() =>
              setActiveDropdown(activeDropdown === 'state' ? null : 'state')
            }
            aria-expanded={activeDropdown === 'state'}
            aria-haspopup="listbox"
          >
            <span className="location-select-value">
              <Map size={17} />
              {loadingStates
                ? t('locationFilter.loadingStates', { defaultValue: 'Carregando estados...' })
                : selectedState?.name ||
                  t('locationFilter.statePlaceholder', { defaultValue: 'Selecione um estado' })}
            </span>
            {loadingStates ? (
              <LoaderCircle className="location-spinner" size={17} />
            ) : (
              <ChevronDown size={17} />
            )}
          </button>

          {activeDropdown === 'state' && (
            <div className="location-dropdown">
              <div className="location-search">
                <Search size={16} />
                <input
                  type="text"
                  autoFocus
                  placeholder={t('locationFilter.searchState', { defaultValue: 'Pesquisar estado...' })}
                  value={stateSearch}
                  onChange={(event) => setStateSearch(event.target.value)}
                />
              </div>
              <ul className="location-options" role="listbox">
                {filteredStates.length ? (
                  filteredStates.map((state) => (
                    <li key={state.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={selectedState?.id === state.id}
                        className={selectedState?.id === state.id ? 'selected' : ''}
                        onClick={() => handleStateSelect(state)}
                      >
                        <span>{state.name}</span>
                        {state.code && <small>{state.code}</small>}
                      </button>
                    </li>
                  ))
                ) : (
                  <li className="location-empty">
                    {loadingStates
                      ? t('locationFilter.loadingStates', { defaultValue: 'Carregando estados...' })
                      : t('locationFilter.noStates', { defaultValue: 'Nenhum estado encontrado.' })}
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>

        <div className="location-field">
          <label>{t('locationFilter.cityLabel')}</label>
          <button
            type="button"
            className={`location-select-trigger ${!selectedState ? 'is-disabled' : ''} ${activeDropdown === 'city' ? 'is-open' : ''}`}
            disabled={!selectedState}
            onClick={() =>
              setActiveDropdown(activeDropdown === 'city' ? null : 'city')
            }
            aria-expanded={activeDropdown === 'city'}
            aria-haspopup="listbox"
          >
            <span className="location-select-value">
              <MapPin size={17} />
              {selectedCity?.name || t('locationFilter.cityPlaceholder')}
            </span>
            <ChevronDown size={17} />
          </button>

          {activeDropdown === 'city' && (
            <div className="location-dropdown">
              <div className="location-search">
                <Search size={16} />
                <input
                  type="text"
                  autoFocus
                  placeholder={t('locationFilter.searchCity')}
                  value={citySearch}
                  onChange={(event) => setCitySearch(event.target.value)}
                />
              </div>
              <ul className="location-options" role="listbox">
                {citySearch.trim().length < 2 ? (
                  <li className="location-empty">
                    {t('locationFilter.typeToSearchCity')}
                  </li>
                ) : loadingCities ? (
                  <li className="location-empty">
                    <LoaderCircle className="location-spinner" size={17} />
                    {t('locationFilter.loadingCities')}
                  </li>
                ) : cities.length ? (
                  cities.map((city) => (
                    <li key={city.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={selectedCity?.id === city.id}
                        className={selectedCity?.id === city.id ? 'selected' : ''}
                        onClick={() => handleCitySelect(city)}
                      >
                        <span>{city.name}</span>
                        {city.stateCode && <small>{city.stateCode}</small>}
                      </button>
                    </li>
                  ))
                ) : (
                  <li className="location-empty">
                    {t('locationFilter.noCities')}
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      </div>

      {error && <p className="location-filter-error" role="alert">{error}</p>}

      {selectedCountry && (
        <div className="location-filter-status">
          <span className="location-status-dot" />
          <span>
            {selectedCity
              ? `${selectedCity.name}, ${selectedState?.name}, ${selectedCountry.name}`
              : selectedState
                ? `${selectedState.name}, ${selectedCountry.name}`
                : selectedCountry.name}
          </span>
        </div>
      )}
    </div>
  );
}
