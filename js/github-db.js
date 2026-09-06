/**
 * OceanDB - GitHub JSON Storage & Local Storage Hybrid DB Engine
 * 깃허브 저장소를 데이터베이스처럼 사용하는 엔진 (매물·소식 저장)
 */

(function (window) {
  'use strict';

  const STORAGE_KEY_CONFIG = 'ocean_db_github_config';

  /* 동/호수를 화면용으로 바꿉니다 (101동 1502호 → 101동 15층)
     전체 호수는 따로 저장하고, 손님에게는 층까지만 보여줍니다. */
  function maskUnit(text) {
    var t = String(text || '').trim();
    if (!t) return '';
    var m = t.match(/^(.*?)(\d{3,4})\s*호?\s*$/);
    if (!m) return t;
    var head = (m[1] || '').trim();
    var floor = Math.floor(parseInt(m[2], 10) / 100);
    if (!floor) return t;
    return (head ? head + ' ' : '') + floor + '층';
  }

  const STORAGE_KEY_POSTS = 'ocean_db_posts_cache';
  const STORAGE_KEY_PROPS = 'ocean_db_props_cache';

  const DEFAULT_CONFIG = {
    owner: '',
    repo: '',
    branch: 'main',
    token: '',
    pathPosts: 'data/posts.json',
    pathProperties: 'data/properties.json'
  };

  // Base64 UTF-8 인코딩 / 디코딩 헬퍼 함수
  function utf8_to_b64(str) {
    return window.btoa(unescape(encodeURIComponent(str)));
  }

  function b64_to_utf8(str) {
    return decodeURIComponent(escape(window.atob(str.replace(/\s/g, ''))));
  }

  /* 저장 충돌인지 판별합니다.
     GitHub 는 "지금 파일이 이 버전이 맞다"는 확인 코드(sha)를 함께 요구하는데,
     연달아 저장하면 한 박자 늦은 코드가 가서 거부당합니다.
     ("... does not match ..." 메시지가 이 경우입니다) */
  function isShaConflict(status, message) {
    if (status === 409) return true;
    if (status === 422 && /does not match|sha/i.test(message || '')) return true;
    return false;
  }

  function wait(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  class OceanDBEngine {
    constructor() {
      this.config = this.loadConfig();
    }

    loadConfig() {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_CONFIG);
        return saved ? { ...DEFAULT_CONFIG, ...JSON.parse(saved) } : { ...DEFAULT_CONFIG };
      } catch (e) {
        console.error('설정 로드 중 오류:', e);
        return { ...DEFAULT_CONFIG };
      }
    }

    saveConfig(newConfig) {
      this.config = { ...this.config, ...newConfig };
      localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(this.config));
    }

    isGitHubConfigured() {
      return Boolean(this.config.owner && this.config.repo && this.config.token);
    }

    // ----------------------------------------------------
    // 소식 게시글 (Posts) 관리 API
    // ----------------------------------------------------
    async getPosts() {
      let posts = [];

      // 1. 깃허브 API 연동 시 최신 데이터 조회 시도
      if (this.isGitHubConfigured()) {
        try {
          const remoteData = await this.fetchFileFromGitHub(this.config.pathPosts);
          if (remoteData && remoteData.content) {
            posts = JSON.parse(remoteData.content);
            localStorage.setItem(STORAGE_KEY_POSTS, JSON.stringify(posts));
            return posts;
          }
        } catch (err) {
          console.warn('깃허브에서 게시글을 불러오는데 실패하여 캐시 데이터를 사용합니다:', err);
        }
      }

      // 2. 로컬 캐시 조회
      const cached = localStorage.getItem(STORAGE_KEY_POSTS);
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch (e) {}
      }

      // 3. 파일 직접 로드 (최초 접속 시 data/posts.json 자원)
      try {
        const res = await fetch('./data/posts.json?t=' + Date.now());
        if (res.ok) {
          posts = await res.json();
          localStorage.setItem(STORAGE_KEY_POSTS, JSON.stringify(posts));
          return posts;
        }
      } catch (e) {
        console.error('posts.json 기본 로드 실패:', e);
      }

      return [];
    }

    async getPostById(id) {
      const posts = await this.getPosts();
      return posts.find((p) => String(p.id) === String(id)) || null;
    }

    async savePost(postData) {
      const posts = await this.getPosts();
      const now = new Date();
      const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;

      let isEdit = false;
      let targetIndex = -1;

      if (postData.id) {
        targetIndex = posts.findIndex((p) => String(p.id) === String(postData.id));
        if (targetIndex !== -1) isEdit = true;
      }

      // 제목이나 날짜가 바뀌면 주소도 바뀝니다. 예전 파일을 지우려고 기억해 둡니다.
      const prevPagePath = (isEdit && posts[targetIndex]) ? (posts[targetIndex].pagePath || '') : '';

      const formattedPost = {
        id: isEdit ? postData.id : 'post-' + Date.now(),
        title: postData.title || '제목 없음',
        category: postData.category || '뉴스',
        date: postData.date || dateStr,
        views: postData.views || (isEdit ? posts[targetIndex].views : 0),
        summary: postData.summary || this.stripHtml(postData.content || '').slice(0, 120) + '...',
        content: postData.content || '',
        imageUrl: postData.imageUrl || '',
        author: postData.author || '오션부동산',
        createdAt: isEdit ? posts[targetIndex].createdAt : now.toISOString(),
        updatedAt: now.toISOString()
      };

      // GEO: 이 글이 가질 개별 페이지 주소 (예: news/2026-09-06-제목.html)
      if (typeof OceanGEO !== 'undefined') {
        formattedPost.pagePath = OceanGEO.pagePath(formattedPost);
      }

      if (isEdit) {
        posts[targetIndex] = formattedPost;
      } else {
        posts.unshift(formattedPost);
      }

      // 로컬 저장
      localStorage.setItem(STORAGE_KEY_POSTS, JSON.stringify(posts));

      // 깃허브 커밋 저장
      let gitHubResult = { success: true, mode: 'local' };
      if (this.isGitHubConfigured()) {
        try {
          const commitMsg = isEdit ? `[OceanDB] 게시글 수정: ${formattedPost.title}` : `[OceanDB] 새 게시글 작성: ${formattedPost.title}`;
          await this.pushFileToGitHub(this.config.pathPosts, JSON.stringify(posts, null, 2), commitMsg);
          gitHubResult = { success: true, mode: 'github' };
        } catch (err) {
          console.error('깃허브 커밋 저장 오류:', err);
          gitHubResult = { success: false, mode: 'github', error: err.message };
        }

        // ----- GEO: AI가 읽을 수 있는 개별 페이지와 사이트맵 -----
        // 여기서 실패해도 글 자체는 이미 저장된 상태이므로 저장을 실패로 만들지 않습니다.
        if (gitHubResult.success && typeof OceanGEO !== 'undefined') {
          try {
            const pagePath = formattedPost.pagePath;

            await this.pushFileToGitHub(
              pagePath,
              OceanGEO.buildPostHtml(formattedPost),
              `[GEO] 게시글 페이지: ${formattedPost.title}`
            );

            // 제목이 바뀌어 주소가 달라졌으면 예전 페이지는 지웁니다
            if (prevPagePath && prevPagePath !== pagePath) {
              await this.deleteFileFromGitHub(prevPagePath, `[GEO] 예전 주소 정리: ${prevPagePath}`);
            }

            await this.pushFileToGitHub(
              'sitemap.xml',
              OceanGEO.buildSitemap(posts),
              '[GEO] sitemap 갱신'
            );

            gitHubResult.geo = { success: true, pagePath: pagePath };
          } catch (err) {
            console.warn('GEO 페이지 생성 실패 (글은 정상 저장됨):', err);
            gitHubResult.geo = { success: false, error: err.message };
          }
        }
      }

      return { post: formattedPost, ...gitHubResult };
    }

    async deletePost(id) {
      let posts = await this.getPosts();
      const target = posts.find((p) => String(p.id) === String(id));
      if (!target) return { success: false, message: '해당 글을 찾을 수 없습니다.' };

      posts = posts.filter((p) => String(p.id) !== String(id));
      localStorage.setItem(STORAGE_KEY_POSTS, JSON.stringify(posts));

      let gitHubResult = { success: true, mode: 'local' };
      if (this.isGitHubConfigured()) {
        try {
          const commitMsg = `[OceanDB] 게시글 삭제: ${target.title}`;
          await this.pushFileToGitHub(this.config.pathPosts, JSON.stringify(posts, null, 2), commitMsg);
          gitHubResult = { success: true, mode: 'github' };

          // GEO: 개별 페이지도 함께 지우고 사이트맵을 다시 만듭니다
          if (typeof OceanGEO !== 'undefined') {
            try {
              const gone = target.pagePath || OceanGEO.pagePath(target);
              await this.deleteFileFromGitHub(gone, `[GEO] 게시글 페이지 삭제: ${target.title}`);
              await this.pushFileToGitHub('sitemap.xml', OceanGEO.buildSitemap(posts), '[GEO] sitemap 갱신');
            } catch (err) {
              console.warn('GEO 페이지 삭제 실패:', err);
            }
          }
        } catch (err) {
          console.error('깃허브 삭제 커밋 실패:', err);
          gitHubResult = { success: false, mode: 'github', error: err.message };
        }
      }

      return gitHubResult;
    }

    async incrementViews(id) {
      const posts = await this.getPosts();
      const idx = posts.findIndex((p) => String(p.id) === String(id));
      if (idx !== -1) {
        posts[idx].views = (posts[idx].views || 0) + 1;
        localStorage.setItem(STORAGE_KEY_POSTS, JSON.stringify(posts));
      }
    }

    // ----------------------------------------------------
    // 매물 (Properties) 관리 API
    // ----------------------------------------------------
    /* 예전 자료를 지금 방식으로 맞춰 줍니다
       · 거래 종류 '급매'  -> 매매 + 급매표시
       · 예전 매물 종류 이름 -> 노션 매물장과 같은 이름 */
    normalizeProps(list) {
      var CAT_MAP = {
        '아파트/주상복합': '아파트',
        '분양권/입주권': '아파트분양권',
        '생활형숙박시설': '생숙',
        '오피스텔/원투룸': '오피스텔',
        '단독/다가구/빌라': '단독/다가구',
        '상가/사무실': '상가점포',
        '토지': '토지/임야'
      };

      return (list || []).map(function (p) {
        if (!p) return p;
        var out = p;
        if (out.type === '급매') {
          out = Object.assign({}, out, { type: '매매', urgent: true });
        }
        if (CAT_MAP[out.category]) {
          out = Object.assign({}, out, { category: CAT_MAP[out.category] });
        }
        return out;
      });
    }

    async getProperties() {
      let props = [];
      if (this.isGitHubConfigured()) {
        try {
          const remoteData = await this.fetchFileFromGitHub(this.config.pathProperties);
          if (remoteData && remoteData.content) {
            props = this.normalizeProps(JSON.parse(remoteData.content));
            localStorage.setItem(STORAGE_KEY_PROPS, JSON.stringify(props));
            return props;
          }
        } catch (err) {}
      }

      const cached = localStorage.getItem(STORAGE_KEY_PROPS);
      if (cached) {
        try {
          return this.normalizeProps(JSON.parse(cached));
        } catch (e) {}
      }

      try {
        const res = await fetch('./data/properties.json?t=' + Date.now());
        if (res.ok) {
          props = this.normalizeProps(await res.json());
          localStorage.setItem(STORAGE_KEY_PROPS, JSON.stringify(props));
          return props;
        }
      } catch (e) {}

      return [];
    }

    async saveProperty(propData) {
      const props = await this.getProperties();
      let isEdit = false;
      let idx = -1;

      if (propData.id) {
        idx = props.findIndex((p) => String(p.id) === String(propData.id));
        if (idx !== -1) isEdit = true;
      }

      const formatted = {
        id: isEdit ? propData.id : 'prop-' + Date.now(),
        /* 노션 매물장과 같은 두 가지 번호
           propertyNo : 내부매물번호 (손님에게 말하는 짧은 번호)
           naverNo    : 매물번호(네이버번호) - 네이버·노션·홈페이지를 잇는 열쇠 */
        propertyNo: (propData.propertyNo || '').trim(),
        naverNo: (propData.naverNo || '').trim(),
        name: propData.name || '신규 매물',
        category: propData.category || '아파트',
        features: propData.features || '',
        unit: propData.unit || '',
        unitPublic: maskUnit(propData.unit),
        type: propData.type || '매매',
        urgent: !!propData.urgent,
        price: propData.price || '가격 문의',
        specs: propData.specs || '',
        location: propData.location || '강원도 강릉시',
        status: propData.status || '노출중',
        badge: propData.badge || propData.type || '매매',
        badgeColor: propData.urgent ? 'danger' : propData.type === '전세' ? 'info' : 'primary',
        imageUrl: propData.imageUrl || 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80',
        description: propData.description || '',
        images: (Array.isArray(propData.images) && propData.images.length)
          ? propData.images
          : (propData.imageUrl ? [propData.imageUrl] : []),
        videoUrl: propData.videoUrl || ''
      };

      if (isEdit) {
        props[idx] = formatted;
      } else {
        props.unshift(formatted);
      }

      localStorage.setItem(STORAGE_KEY_PROPS, JSON.stringify(props));

      let gitHubResult = { success: true, mode: 'local' };
      if (this.isGitHubConfigured()) {
        try {
          const commitMsg = isEdit ? `[OceanDB] 매물 수정: ${formatted.name}` : `[OceanDB] 매물 등록: ${formatted.name}`;
          await this.pushFileToGitHub(this.config.pathProperties, JSON.stringify(props, null, 2), commitMsg);
          gitHubResult = { success: true, mode: 'github' };
        } catch (err) {
          gitHubResult = { success: false, mode: 'github', error: err.message };
        }
      }

      return { property: formatted, ...gitHubResult };
    }

    async deleteProperty(id) {
      let props = await this.getProperties();
      const target = props.find((p) => String(p.id) === String(id));
      if (!target) return { success: false, message: '매물을 찾을 수 없습니다.' };

      props = props.filter((p) => String(p.id) !== String(id));
      localStorage.setItem(STORAGE_KEY_PROPS, JSON.stringify(props));

      let gitHubResult = { success: true, mode: 'local' };
      if (this.isGitHubConfigured()) {
        try {
          await this.pushFileToGitHub(this.config.pathProperties, JSON.stringify(props, null, 2), `[OceanDB] 매물 삭제: ${target.name}`);
          gitHubResult = { success: true, mode: 'github' };
        } catch (err) {
          gitHubResult = { success: false, mode: 'github', error: err.message };
        }
      }

      return gitHubResult;
    }

    // ----------------------------------------------------
    // GitHub REST API 통신 모듈 (Low-level)
    // ----------------------------------------------------
    // 한글이 들어간 파일 이름도 GitHub API가 알아듣게 바꿔 줍니다
    encodePath(filePath) {
      return String(filePath).split('/').map(encodeURIComponent).join('/');
    }

    async fetchFileFromGitHub(filePath) {
      const { owner, repo, token, branch } = this.config;
      // ?t= 와 no-store 로 브라우저가 예전 응답을 재사용하지 못하게 합니다.
      // (예전 확인 코드를 보내면 저장이 거부됩니다)
      const url = `https://api.github.com/repos/${owner}/${repo}/contents/${this.encodePath(filePath)}?ref=${branch}&t=${Date.now()}`;

      const res = await fetch(url, {
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json'
        }
      });

      if (!res.ok) {
        throw new Error(`GitHub API 호출 실패 (${res.status}: ${res.statusText})`);
      }

      const data = await res.json();
      const decodedContent = b64_to_utf8(data.content);
      return {
        sha: data.sha,
        content: decodedContent
      };
    }

    // 저장소에서 파일 하나를 지웁니다 (없으면 조용히 넘어갑니다)
    async deleteFileFromGitHub(filePath, commitMessage) {
      const { owner, repo, token, branch } = this.config;

      const url = `https://api.github.com/repos/${owner}/${repo}/contents/${this.encodePath(filePath)}`;
      let lastErr = null;

      for (let attempt = 1; attempt <= 3; attempt++) {
        let sha = '';
        try {
          sha = (await this.fetchFileFromGitHub(filePath)).sha;
        } catch (e) {
          return null;   // 원래 없던 파일
        }

        const res = await fetch(url, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/vnd.github.v3+json'
          },
          body: JSON.stringify({ message: commitMessage, sha: sha, branch: branch })
        });

        if (res.ok) return await res.json();

        const errJson = await res.json().catch(() => ({}));
        lastErr = new Error(errJson.message || `GitHub 파일 삭제 실패 (${res.status})`);

        if (!isShaConflict(res.status, errJson.message) || attempt === 3) break;
        console.warn(`삭제가 충돌하여 다시 시도합니다 (${attempt}/3): ${filePath}`);
        await wait(400 * attempt);
      }

      throw lastErr;
    }

    async pushFileToGitHub(filePath, contentString, commitMessage) {
      const { owner, repo, token, branch } = this.config;
      const url = `https://api.github.com/repos/${owner}/${repo}/contents/${this.encodePath(filePath)}`;

      let lastErr = null;

      // 저장이 충돌하면 확인 코드를 새로 받아 최대 3번까지 다시 시도합니다
      for (let attempt = 1; attempt <= 3; attempt++) {
        let sha = '';
        try {
          sha = (await this.fetchFileFromGitHub(filePath)).sha;
        } catch (e) {
          sha = '';   // 원래 없던 파일이면 새로 만듭니다
        }

        const payload = {
          message: commitMessage,
          content: utf8_to_b64(contentString),
          branch: branch
        };
        if (sha) payload.sha = sha;

        const res = await fetch(url, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/vnd.github.v3+json'
          },
          body: JSON.stringify(payload)
        });

        if (res.ok) return await res.json();

        const errJson = await res.json().catch(() => ({}));
        lastErr = new Error(errJson.message || `GitHub 커밋 실패 (${res.status})`);

        if (!isShaConflict(res.status, errJson.message) || attempt === 3) break;
        console.warn(`저장이 충돌하여 다시 시도합니다 (${attempt}/3): ${filePath}`);
        await wait(400 * attempt);
      }

      throw lastErr;
    }

    stripHtml(html) {
      const tmp = document.createElement('DIV');
      tmp.innerHTML = html;
      return tmp.textContent || tmp.innerText || '';
    }

    // ----------------------------------------------------
    // UI Modal Helper (GitHub 설정 팝업)
    // ----------------------------------------------------
    openConfigModal() {
      let modal = document.getElementById('ocean-db-config-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'ocean-db-config-modal';
        modal.className = 'fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity duration-200';
        modal.innerHTML = `
          <div class="bg-white dark:bg-gray-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 relative transform transition-all scale-100">
            <button type="button" id="ocean-db-close-btn" class="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1">
              <span class="material-symbols-outlined">close</span>
            </button>
            <div class="flex items-center gap-3 mb-4">
              <div class="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <span class="material-symbols-outlined">cloud_sync</span>
              </div>
              <div>
                <h3 class="font-bold text-lg text-gray-900 dark:text-white">무료 GitHub JSON DB 연동 설정</h3>
                <p class="text-xs text-gray-500">매물과 소식을 깃허브 저장소에 무료로 저장·관리합니다.</p>
              </div>
            </div>

            <form id="ocean-db-config-form" class="space-y-4">
              <div>
                <label class="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">GitHub 사용자/조직명 (Owner)</label>
                <input type="text" id="oc-cfg-owner" class="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="예: mygithubname" required>
              </div>
              <div>
                <label class="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">저장소 이름 (Repo Name)</label>
                <input type="text" id="oc-cfg-repo" class="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="예: ocean-realestate" required>
              </div>
              <div>
                <label class="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">개인 액세스 토큰 (GitHub PAT Token)</label>
                <input type="password" id="oc-cfg-token" class="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="ghp_xxxxxxxxxxxx 또는 github_pat_xxxx" required>
                <p class="text-[11px] text-gray-400 mt-1">Repo 권한(repo / contents:write)이 부여된 토큰을 입력하세요.</p>
              </div>
              <div>
                <label class="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">브랜치 (Branch)</label>
                <input type="text" id="oc-cfg-branch" class="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="main" value="main">
              </div>

              <div class="pt-2 flex items-center justify-between">
                <button type="button" id="oc-help-btn" class="text-xs text-blue-600 hover:underline flex items-center gap-1">
                  <span class="material-symbols-outlined text-sm">help</span> 토큰 발급 1분 가이드
                </button>
                <div class="flex gap-2">
                  <button type="button" id="oc-cancel-btn" class="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">취소</button>
                  <button type="submit" class="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm">저장 및 테스트</button>
                </div>
              </div>
            </form>
          </div>
        `;
        document.body.appendChild(modal);

        // 이벤트 바인딩
        document.getElementById('ocean-db-close-btn').addEventListener('click', () => this.closeConfigModal());
        document.getElementById('oc-cancel-btn').addEventListener('click', () => this.closeConfigModal());
        document.getElementById('oc-help-btn').addEventListener('click', () => this.showTokenGuideModal());

        document.getElementById('ocean-db-config-form').addEventListener('submit', async (e) => {
          e.preventDefault();
          const owner = document.getElementById('oc-cfg-owner').value.trim();
          const repo = document.getElementById('oc-cfg-repo').value.trim();
          const token = document.getElementById('oc-cfg-token').value.trim();
          const branch = document.getElementById('oc-cfg-branch').value.trim() || 'main';

          this.saveConfig({ owner, repo, token, branch });

          if (window.OceanMotion) {
            window.OceanMotion.showToast('GitHub 연동 정보를 저장 중입니다...', 'info');
          }

          try {
            await this.fetchFileFromGitHub(this.config.pathPosts);
            if (window.OceanMotion) {
              window.OceanMotion.showToast('🟢 GitHub DB 연동에 성공했습니다!', 'success');
            } else {
              alert('🟢 GitHub DB 연동 성공!');
            }
            this.closeConfigModal();
            location.reload();
          } catch (err) {
            alert('⚠️ GitHub 연동 실패: ' + err.message + '\n입력한 계정, 저장소 이름, 토큰 권한을 확인해주세요.');
          }
        });
      }

      // 값 채우기
      document.getElementById('oc-cfg-owner').value = this.config.owner || '';
      document.getElementById('oc-cfg-repo').value = this.config.repo || '';
      document.getElementById('oc-cfg-token').value = this.config.token || '';
      document.getElementById('oc-cfg-branch').value = this.config.branch || 'main';

      modal.classList.remove('hidden');
    }

    closeConfigModal() {
      const modal = document.getElementById('ocean-db-config-modal');
      if (modal) modal.classList.add('hidden');
    }

    showTokenGuideModal() {
      alert(
        '🔑 [무료 GitHub 토큰(PAT) 발급 가이드]\n\n' +
        '1. GitHub 로그인 후 상단 프로필 클릭 -> [Settings] 이동\n' +
        '2. 좌측 맨 아래 [Developer settings] 클릭\n' +
        '3. [Personal access tokens] -> [Tokens (classic)] 선택\n' +
        '4. [Generate new token (classic)] 클릭 후 Note에 "OceanDB" 입력\n' +
        '5. Expiration(유기한)을 "No expiration" 또는 원하는 기한으로 선택\n' +
        '6. Select scopes에서 [repo] 전체 체크 후 맨 아래 [Generate token] 클릭\n' +
        '7. 생성된 ghp_... 토큰 복사 후 이 설정창에 붙여넣기 하면 끝!'
      );
    }
  }

  window.OceanDB = new OceanDBEngine();

  // DOM 렌더링 시 GitHub 연동 상태 배지 자동 업데이트
  document.addEventListener('DOMContentLoaded', () => {
    const statusBadges = document.querySelectorAll('.oc-github-status');
    statusBadges.forEach((el) => {
      if (window.OceanDB.isGitHubConfigured()) {
        el.innerHTML = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-pointer" title="클릭하여 GitHub 연동 설정 변경">
          <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> GitHub JSON DB 연결됨
        </span>`;
      } else {
        el.innerHTML = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 cursor-pointer" title="클릭하여 GitHub 100% 무료 연동 설정">
          <span class="w-2 h-2 rounded-full bg-amber-500"></span> 로컬 브라우저 캐시 모드 (무료 GitHub 연동하기)
        </span>`;
      }
      el.addEventListener('click', () => window.OceanDB.openConfigModal());
    });
  });
})(window);
