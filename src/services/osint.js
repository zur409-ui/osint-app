// src/services/osint.js

// Вспомогательная функция для безопасного fetch с обработкой ошибок
async function safeFetch(url, options = {}) {
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`[OSINT] Ошибка запроса к ${url}:`, error);
    throw error;
  }
}

// ==========================================
// 1. ПОИСК КОМПАНИЙ И ИНН (DaData + OpenCorporates)
// ==========================================

export async function searchCompany(query) {
  const dadataToken = import.meta.env.VITE_DADATA_TOKEN;
  const ocToken = import.meta.env.VITE_OPENCORPORATES_TOKEN;

  // ШАГ 1: Пробуем DaData (РФ/СНГ)
  if (dadataToken) {
    try {
      const url = 'https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/party';
      const response = await fetch(url, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Token ${dadataToken}`
        },
        body: JSON.stringify({ query: query, count: 5 })
      });

      if (response.ok) {
        const data = await response.json();
        const results = data.suggestions || [];
        
        if (results.length > 0) {
          return {
            source: 'DaData (ЕГРЮЛ/ЕГРИП)',
            query: query,
            data: results.map(item => ({
              name: item.value,
              inn: item.data.inn,
              ogrn: item.data.ogrn,
              status: item.data.state.status === "ACTIVE" ? "Действующая" : "Неактивна/Ликвидирована",
              address: item.data.address.value,
              director: item.data.management?.name || "Не указан в ЕГРЮЛ",
              director_inn: item.data.management?.inn || "Н/Д",
              registration_date: item.data.ogrn_date,
              url: `https://www.rusprofile.ru/search?query=${item.data.inn}`
            })),
            message: `Найдено организаций: ${results.length}`
          };
        }
      }
    } catch (error) {
      console.warn('[OSINT] DaData не вернула результатов, пробуем резервный источник...', error);
    }
  }

  // ШАГ 2: Резервный поиск через OpenCorporates (США/ЕС/Оффшоры)
  if (ocToken) {
    try {
      const encodedQuery = encodeURIComponent(query);
      const url = `https://api.opencorporates.com/v0.4/companies/search?q=${encodedQuery}&api_token=${ocToken}`;
      const data = await safeFetch(url);
      
      const results = data.results?.companies || [];
      if (results.length > 0) {
        return {
          source: 'OpenCorporates (Western Jurisdictions)',
          query: query,
          data: results.slice(0, 5).map(c => ({
            name: c.company.name,
            jurisdiction: c.company.jurisdiction_code,
            company_number: c.company.company_number,
            status: c.company.current_status,
            url: `https://opencorporates.com${c.company.opencorporates_url}`,
            note: 'Для поиска офицеров/директоров перейдите по ссылке на страницу компании'
          })),
          message: `Найдено совпадений: ${results.length}`
        };
      }
    } catch (error) {
      console.warn('[OSINT] OpenCorporates также не вернул результатов.', error);
    }
  }

  throw new Error('Компания не найдена. Убедитесь, что в .env указаны VITE_DADATA_TOKEN или VITE_OPENCORPORATES_TOKEN.');
}


// ==========================================
// 2. ПОИСК ПЕРСОНАЛА ПО ДОМЕНУ КОМПАНИИ (Hunter.io)
// ==========================================

export async function searchPersonnelByDomain(domain) {
  const hunterToken = import.meta.env.VITE_HUNTER_TOKEN;

  if (!hunterToken) {
    throw new Error('Для поиска персонала требуется VITE_HUNTER_TOKEN в файле .env (бесплатно 25 запросов/мес на hunter.io)');
  }

  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];

  const url = `https://api.hunter.io/v2/domain-search?domain=${cleanDomain}&api_key=${hunterToken}`;
  const data = await safeFetch(url);

  const emails = data.data?.emails || [];
  
  if (emails.length === 0) {
    return {
      source: 'Hunter.io',
      query: cleanDomain,
      data: [],
      message: 'Публичные email-адреса сотрудников не найдены. Попробуйте проверить домен вручную.'
    };
  }

  return {
    source: 'Hunter.io (Personnel Discovery)',
    query: cleanDomain,
    data: emails.slice(0, 10).map(person => ({
      name: person.first_name && person.last_name ? `${person.first_name} ${person.last_name}` : 'Имя скрыто',
      position: person.position || 'Должность не указана',
      email: person.value,
      confidence: person.confidence,
      linkedin: person.linkedin || null,
      twitter: person.twitter || null
    })),
    message: `Найдено контактов: ${emails.length} (показано первые 10). Источник: публичные упоминания в сети.`
  };
}


// ==========================================
// 3. ПОИСК ТЕХНИЧЕСКОГО ПЕРСОНАЛА (GitHub)
// ==========================================

export async function searchTechPersonnelByCompany(companyName) {
  const url = `https://api.github.com/search/users?q=company:${encodeURIComponent(companyName)}`;
  const data = await safeFetch(url, {
    headers: { 'Accept': 'application/vnd.github.v3+json' }
  });

  const users = data.items || [];
  
  return {
    source: 'GitHub (Tech Personnel)',
    query: companyName,
    data: users.slice(0, 10).map(user => ({
      login: user.login,
      name: user.name || 'Не указано',
      profile_url: user.html_url,
      avatar_url: user.avatar_url,
      public_repos: user.public_repos
    })),
    message: `Найдено разработчиков, указавших компанию: ${users.length}`
  };
}


// ==========================================
// 4. БАЗОВЫЕ OSINT ФУНКЦИИ (IP, Email, Domain)
// ==========================================

export async function searchIP(ip) {
  const url = `https://ipapi.co/${ip}/json/`;
  const data = await safeFetch(url);
  return {
    source: 'IP-API',
    query: ip,
    data: {
      ip: data.ip,
      city: data.city,
      region: data.region,
      country: data.country_name,
      org: data.org,
      timezone: data.timezone,
    }
  };
}

export async function searchEmail(email) {
  const url = `https://emailrep.io/${email}`;
  const data = await safeFetch(url, { headers: { 'Accept': 'application/json' } });
  return {
    source: 'EmailRep',
    query: email,
    data: {
      reputation: data.reputation,
      suspicious: data.suspicious,
      references: data.references,
      details_created: data.details?.account_created,
      details_last_seen: data.details?.last_seen,
    }
  };
}