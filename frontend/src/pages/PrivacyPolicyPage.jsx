/**
 * @file src/pages/PrivacyPolicyPage.jsx
 * @description Renders the static privacy policy document with anchor navigation.
 * Responsibilities:
 * - Expose a table of contents for in-page section jumps.
 * - Provide a manual scroll-to-top helper for long-form legal text.
 * Key dependencies:
 * - ./LegalPage.css
 * Side effects:
 * - Uses window scrolling APIs for in-page navigation.
 * Role in app flow:
 * - Legal route rendered directly from the top-level router.
 */
import './LegalPage.css';

export default function PrivacyPolicyPage() {
    const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

    return (
        <div className="legal-page">
            {/* Hero */}
            <header className="legal-hero">
                <h1>개인정보처리방침</h1>
                <p className="effective-date">시행일: 2026년 3월 2일</p>
            </header>

            {/* TOC */}
            <nav className="legal-toc">
                <h2>목차</h2>
                <ol>
                    <li><a href="#purpose">개인정보의 처리목적</a></li>
                    <li><a href="#items">처리하는 개인정보 항목 및 수집 방법</a></li>
                    <li><a href="#retention">개인정보의 처리 및 보유기간</a></li>
                    <li><a href="#third-party">개인정보의 제3자 제공</a></li>
                    <li><a href="#outsourcing">개인정보 처리 위탁</a></li>
                    <li><a href="#overseas">개인정보의 국외 이전</a></li>
                    <li><a href="#rights">정보주체의 권리·의무 및 행사방법</a></li>
                    <li><a href="#children">14세 미만 아동의 개인정보</a></li>
                    <li><a href="#destruction">개인정보의 파기</a></li>
                    <li><a href="#auto-collection">자동 수집 정보 및 쿠키</a></li>
                    <li><a href="#security">개인정보의 안전성 확보 조치</a></li>
                    <li><a href="#officer">개인정보 보호책임자</a></li>
                    <li><a href="#changes">개인정보 처리방침의 변경</a></li>
                </ol>
            </nav>

            {/* 1. 처리목적 */}
            <section id="purpose" className="legal-section">
                <h2>제1조 (개인정보의 처리목적)</h2>
                <p>
                    beomseo.in(이하 "사이트")은 범서고등학교 학생 커뮤니티 서비스 제공을 위해
                    다음의 목적으로 개인정보를 처리합니다. 처리하는 개인정보는 다음의 목적
                    이외의 용도로는 이용되지 않으며, 이용 목적이 변경되는 경우에는 「개인정보
                    보호법」 제18조에 따라 별도의 동의를 받는 등 필요한 조치를 이행할
                    예정입니다.
                </p>
                <ol>
                    <li>
                        <strong>회원 가입 및 관리:</strong> 회원 가입의사 확인, 회원 식별 및 본인
                        확인, 회원자격 유지·관리, 서비스 부정 이용 방지
                    </li>
                    <li>
                        <strong>서비스 제공:</strong> 게시판(공지사항, 자유게시판, 학생 청원,
                        동아리 모집, 선택과목 변경, 설문조사 품앗이, 분실물 센터, 곰솔마켓 등),
                        갤러리, 실시간 투표, 급식 정보, 학사 일정 등 커뮤니티 서비스 제공
                    </li>
                    <li>
                        <strong>게시물 관리:</strong> 게시물 작성·수정·삭제 및 승인 관리
                    </li>
                    <li>
                        <strong>서비스 보안 및 부정 이용 방지:</strong> 부정 게시물·스팸 탐지,
                        비정상적 접근 식별, 분쟁 발생 시 사실 확인을 위한 접속 기록 보존
                    </li>
                    <li>
                        <strong>서비스 개선:</strong> 접속 빈도 분석, 서비스 이용 통계 수집을
                        통한 서비스 개선
                    </li>
                </ol>
            </section>

            {/* 2. 처리하는 항목 */}
            <section id="items" className="legal-section">
                <h2>제2조 (처리하는 개인정보 항목 및 수집 방법)</h2>

                <h3>가. 회원가입 시 수집 항목</h3>
                <div className="legal-table-wrap">
                    <table className="legal-table">
                        <thead>
                            <tr>
                                <th>구분</th>
                                <th>수집 항목</th>
                                <th>수집 목적</th>
                                <th>법적 근거</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>필수</td>
                                <td>닉네임, 비밀번호(bcrypt 단방향 암호화 저장)</td>
                                <td>회원 식별 및 서비스 이용</td>
                                <td>「개인정보 보호법」 제15조 제1항 제1호 (동의)</td>
                            </tr>
                            <tr>
                                <td>자동 수집</td>
                                <td>가입 시점 IP 주소, User-Agent(브라우저/OS 정보)</td>
                                <td>울산광역시교육청 IP 대역 확인(가입 자격 검증), 부정 가입 방지</td>
                                <td>「개인정보 보호법」 제15조 제1항 제6호 (정당한 이익)</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div className="legal-highlight">
                    본 사이트는 이름, 이메일, 전화번호 등 실명 식별이 가능한 개인정보를 수집하지
                    않으며, 닉네임과 비밀번호만으로 익명성을 보장합니다.
                </div>

                <h3>나. 서비스 이용 과정에서 자동 수집되는 항목</h3>
                <div className="legal-table-wrap">
                    <table className="legal-table">
                        <thead>
                            <tr>
                                <th>수집 항목</th>
                                <th>수집 시점</th>
                                <th>수집 목적</th>
                                <th>법적 근거</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>IP 주소, User-Agent(브라우저 종류·버전, OS)</td>
                                <td>게시물 작성, 댓글 작성, 투표, 설문 응답, 청원 동의, 반응(좋아요), 파일 업로드 등 모든 콘텐츠 생성 시점</td>
                                <td>게시물별 작성자 행위 추적, 부정 이용 방지, 분쟁 시 사실 확인</td>
                                <td>「정보통신망법」 제22조, 「개인정보 보호법」 제15조 제1항 제6호</td>
                            </tr>
                            <tr>
                                <td>IP 주소, User-Agent</td>
                                <td>로그인·토큰 발급 시</td>
                                <td>인증 토큰 관리, 비정상 로그인 탐지</td>
                                <td>「개인정보 보호법」 제15조 제1항 제6호 (정당한 이익)</td>
                            </tr>
                            <tr>
                                <td>페이지 접속 기록, 사용자 행동 데이터, 브라우저/기기 정보, 대략적 지리적 위치(IP 기반, 도시 수준)</td>
                                <td>서비스 이용 전반</td>
                                <td>서비스 이용 통계 분석(Google Analytics), 서비스 최적화</td>
                                <td>「개인정보 보호법」 제15조 제1항 제6호</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div className="legal-highlight">
                    <strong>⚠ 수집 범위 안내:</strong> 사이트는 게시물·댓글·투표·설문 응답·청원 동의·
                    파일 업로드 등 <strong>모든 콘텐츠 생성 행위</strong>에 대해 작성 시점의 IP 주소와
                    User-Agent(브라우저·OS 정보)를 해당 콘텐츠와 함께 데이터베이스에 저장합니다.
                    이는 부정 이용 방지, 이용자 보호, 법적 분쟁 대응을 위한 것이며, 해당 정보는
                    관리자만 열람할 수 있습니다.
                </div>

                <h3>다. 게시물 작성 시 수집되는 항목</h3>
                <p>
                    이용자가 게시판에 업로드하는 텍스트, 이미지 파일 등의 게시물 내용은 서비스
                    제공을 위해 처리됩니다. 첨부 파일은 최대 10MB, 게시물당 최대 5개까지
                    업로드할 수 있습니다.
                </p>

                <h3>라. 수집 방법</h3>
                <ul>
                    <li>회원가입 양식을 통한 직접 입력</li>
                    <li>서비스 이용 과정에서 서버 측 자동 기록 (IP 주소, User-Agent 등)</li>
                    <li>Google Analytics 스크립트를 통한 방문·이용 통계 수집</li>
                </ul>
            </section>

            {/* 3. 보유기간 */}
            <section id="retention" className="legal-section">
                <h2>제3조 (개인정보의 처리 및 보유기간)</h2>
                <p>
                    사이트는 법령에 따른 개인정보 보유·이용기간 또는 정보주체로부터 개인정보를
                    수집 시에 동의받은 개인정보 보유·이용기간 내에서 개인정보를 처리·보유합니다.
                    각 개인정보의 처리 및 보유기간은 다음과 같습니다:
                </p>
                <div className="legal-table-wrap">
                    <table className="legal-table">
                        <thead>
                            <tr>
                                <th>구분</th>
                                <th>보유기간</th>
                                <th>근거</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>회원 계정 정보 (닉네임, 암호화된 비밀번호, 가입 시 IP/UA)</td>
                                <td>회원 탈퇴 시까지</td>
                                <td>회원 동의, 「개인정보 보호법」 제15조</td>
                            </tr>
                            <tr>
                                <td>게시물·댓글·투표·설문 응답 등 이용자 작성 콘텐츠</td>
                                <td>게시물 비공개 처리 또는 회원 삭제 요청 시까지</td>
                                <td>서비스 제공, 「개인정보 보호법」 제15조</td>
                            </tr>
                            <tr>
                                <td>콘텐츠 생성 시 기록된 IP 주소·User-Agent</td>
                                <td>해당 콘텐츠 삭제 시까지 (단, 법령이 보존을 요구하는 경우 해당 법정 기간)</td>
                                <td>「개인정보 보호법」 제15조 제1항 제6호, 「통신비밀보호법」 제15조의2</td>
                            </tr>
                            <tr>
                                <td>서비스 이용 기록 (로그인·접속 로그)</td>
                                <td>3개월</td>
                                <td>「통신비밀보호법」 제15조의2 (전기통신사업자의 통신사실확인자료 보존)</td>
                            </tr>
                            <tr>
                                <td>인증 토큰 기록 (토큰 메타데이터, IP, UA)</td>
                                <td>토큰 만료 또는 회전 처리 후 3개월</td>
                                <td>「통신비밀보호법」 제15조의2, 서비스 보안</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>

            {/* 4. 제3자 제공 */}
            <section id="third-party" className="legal-section">
                <h2>제4조 (개인정보의 제3자 제공)</h2>
                <p>
                    사이트는 원칙적으로 이용자의 개인정보를 외부에 제공하지 않습니다. 다만,
                    다음의 경우에는 예외로 합니다.
                </p>
                <ol>
                    <li>이용자가 사전에 동의한 경우</li>
                    <li>
                        법령에 의거하거나, 수사 목적으로 법령에 정해진 절차와 방법에 따라
                        수사기관의 요구가 있는 경우 (「개인정보 보호법」 제17조, 제18조)
                    </li>
                    <li>
                        통계 작성 및 학술 연구 등의 목적을 위해 필요한 경우로서 특정 개인을
                        알아볼 수 없는 형태로 개인정보를 제공하는 경우
                    </li>
                </ol>
            </section>

            {/* 5. 위탁 */}
            <section id="outsourcing" className="legal-section">
                <h2>제5조 (개인정보 처리 위탁)</h2>
                <p>
                    사이트는 원활한 서비스 제공을 위해 다음과 같이 개인정보 처리를 위탁하고
                    있습니다. 「개인정보 보호법」 제26조에 따라 위탁 업무 내용과 수탁자를
                    고지합니다.
                </p>
                <div className="legal-table-wrap">
                    <table className="legal-table">
                        <thead>
                            <tr>
                                <th>수탁업체</th>
                                <th>위탁 업무 내용</th>
                                <th>처리되는 개인정보 항목</th>
                                <th>보유 및 이용기간</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>Cloudflare, Inc.</td>
                                <td>
                                    CDN(콘텐츠 전송 네트워크) 제공, DDoS 방어, 웹 방화벽(WAF), DNS
                                    프록시, 보안 관리
                                </td>
                                <td>IP 주소, HTTP 요청 헤더 (User-Agent 포함)</td>
                                <td>서비스 이용 기간 또는 위탁 계약 종료 시까지</td>
                            </tr>
                            <tr>
                                <td>Google LLC (Google Analytics)</td>
                                <td>
                                    웹사이트 이용 통계 분석
                                </td>
                                <td>브라우저/기기 정보, 대략적 위치, 페이지 방문 기록, 사용자 행동 이벤트</td>
                                <td>서비스 이용 기간 또는 위탁 계약 종료 시까지</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>

            {/* 6. 국외 이전 */}
            <section id="overseas" className="legal-section">
                <h2>제6조 (개인정보의 국외 이전)</h2>
                <p>
                    사이트는 서비스 제공을 위해 「개인정보 보호법」 제28조의8에 따라 다음과 같이
                    개인정보를 국외로 이전합니다.
                </p>
                <div className="legal-table-wrap">
                    <table className="legal-table">
                        <thead>
                            <tr>
                                <th>이전받는 자</th>
                                <th>이전되는 국가</th>
                                <th>이전 목적</th>
                                <th>이전 항목</th>
                                <th>보유·이용기간</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>Cloudflare, Inc.</td>
                                <td>미국 및 글로벌 엣지 서버 소재지</td>
                                <td>CDN, 보안 서비스 제공</td>
                                <td>IP 주소, HTTP 요청 헤더</td>
                                <td>서비스 제공 기간</td>
                            </tr>
                            <tr>
                                <td>Google LLC</td>
                                <td>미국</td>
                                <td>웹 이용 통계 분석</td>
                                <td>익명화된 이용 행태 정보</td>
                                <td>Google Analytics 데이터 보존 설정에 따름</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <p>
                    이용자는 개인정보의 국외 이전에 대해 동의를 거부할 수 있으며, 거부 시
                    서비스 이용에 제한이 있을 수 있습니다.
                </p>
            </section>

            {/* 7. 권리 */}
            <section id="rights" className="legal-section">
                <h2>제7조 (정보주체의 권리·의무 및 행사방법)</h2>
                <p>
                    이용자는 「개인정보 보호법」 제35조~제37조에 따라 개인정보 주체로서 다음과
                    같은 권리를 행사할 수 있습니다.
                </p>
                <ol>
                    <li>
                        <strong>개인정보 열람 요구</strong> (「개인정보 보호법」 제35조): 사이트가
                        보유한 자신의 개인정보(게시물에 기록된 IP 주소·User-Agent 포함)에 대한
                        열람을 요구할 수 있습니다.
                    </li>
                    <li>
                        <strong>개인정보 정정·삭제 요구</strong> (「개인정보 보호법」 제36조): 보유
                        중인 개인정보에 오류가 있는 경우 정정 또는 삭제를 요구할 수 있습니다.
                        단, 다른 법령에서 수집 대상으로 명시된 개인정보는 삭제를 요구할 수
                        없습니다.
                    </li>
                    <li>
                        <strong>개인정보 처리 정지 요구</strong> (「개인정보 보호법」 제37조):
                        자신의 개인정보 처리 정지를 요구할 수 있습니다. 단, 법률에 특별한
                        규정이 있거나 법령상 의무를 준수하기 위해 불가피한 경우, 다른 사람의
                        생명·신체를 해할 우려가 있는 경우 등에는 처리 정지 요구를 거절할 수
                        있습니다.
                    </li>
                    <li>
                        <strong>동의 철회 및 회원 탈퇴:</strong> 회원은 언제든지 개인정보
                        보호책임자에게 연락하여 동의를 철회하거나 회원 탈퇴를 요청할 수
                        있습니다.
                    </li>
                </ol>
                <p>
                    위 권리 행사는 사이트 내 계정 설정에서 직접 처리하거나, 개인정보
                    보호책임자에게 서면, 전화, 전자우편 등으로 연락하여 행사할 수 있으며,
                    사이트는 이에 대해 지체 없이(10일 이내) 조치하겠습니다.
                </p>
                <p>
                    이용자가 개인정보의 오류 등에 대한 정정 또는 삭제를 요구한 경우에는 정정
                    또는 삭제를 완료할 때까지 당해 개인정보를 이용하거나 제공하지 않습니다.
                </p>
                <p>
                    권리 행사는 정보주체의 법정대리인이나 위임을 받은 자 등 대리인을 통해서도
                    할 수 있습니다.
                </p>
            </section>

            {/* 8. 14세 미만 */}
            <section id="children" className="legal-section">
                <h2>제8조 (14세 미만 아동의 개인정보)</h2>
                <p>
                    사이트는 원칙적으로 범서고등학교 학생(만 15세 이상)을 대상으로 서비스를
                    제공하며, 14세 미만 아동의 개인정보를 별도로 수집하지 않습니다.
                </p>
                <p>
                    만약 14세 미만 아동의 개인정보가 수집된 것이 확인될 경우, 「개인정보
                    보호법」 제22조 제6항에 따라 법정대리인의 동의를 확인하거나, 동의가
                    확인되지 않는 경우 해당 개인정보를 지체 없이 파기합니다.
                </p>
            </section>

            {/* 9. 파기 */}
            <section id="destruction" className="legal-section">
                <h2>제9조 (개인정보의 파기)</h2>
                <p>
                    사이트는 개인정보 보유기간이 경과하거나 처리목적이 달성된 경우에는
                    「개인정보 보호법」 제21조에 따라 지체 없이(5일 이내) 해당 개인정보를
                    파기합니다.
                </p>
                <h3>파기 절차</h3>
                <p>
                    이용자가 입력한 정보는 목적 달성 후 별도의 DB에 옮겨져(법령에 의한
                    보존 의무가 있는 경우) 내부 방침 및 기타 관련 법령에 따라 일정 기간 저장된
                    후 파기되거나, 보존 의무가 없는 경우 즉시 파기됩니다.
                </p>
                <h3>파기 방법</h3>
                <ul>
                    <li>
                        <strong>전자적 파일 형태:</strong> 기록을 재생할 수 없는 기술적 방법을
                        사용하여 안전하게 삭제 (예: 데이터베이스 레코드 영구 삭제)
                    </li>
                    <li>
                        <strong>종이에 출력된 개인정보:</strong> 분쇄기로 분쇄하거나 소각하여
                        파기 (해당 시)
                    </li>
                </ul>
            </section>

            {/* 10. 자동 수집 */}
            <section id="auto-collection" className="legal-section">
                <h2>제10조 (자동 수집 정보 및 쿠키)</h2>

                <h3>가. 서버 측 자동 기록 (IP 주소 · User-Agent)</h3>
                <p>
                    사이트는 이용자의 콘텐츠 생성 행위(게시물·댓글·투표·설문 응답·청원 동의·
                    파일 업로드 등) 시점에 서버 측에서 자동으로 IP 주소와 User-Agent
                    (브라우저 종류·버전, 운영체제 정보)를 데이터베이스에 기록합니다.
                    이 정보는 부정 이용 방지, 분쟁 시 사실 확인, 법적 의무 이행을 위해
                    수집됩니다.
                </p>

                <h3>나. 인증 쿠키</h3>
                <p>
                    사이트는 이용자 인증을 위해 HttpOnly 쿠키 기반 인증 토큰을 사용합니다.
                    토큰은 브라우저의 JavaScript에서 직접 접근할 수 없도록 설정되어 XSS로 인한
                    토큰 탈취 위험을 낮춥니다.
                </p>
                <ul>
                    <li>
                        <strong>Access Token:</strong> 발급 후 30분간 유효하며, API 요청 인증에
                        사용됩니다.
                    </li>
                    <li>
                        <strong>Refresh Token:</strong> 발급 후 7일간 유효하며, Access Token
                        갱신에 사용됩니다.
                    </li>
                </ul>
                <p>
                    이용자는 로그아웃 또는 세션 만료 시 인증 쿠키가 자동 폐기되며, 서버는 토큰
                    회전 및 폐기 정책을 통해 장기 세션 노출을 제한합니다.
                </p>

                <h3>다. Cloudflare 쿠키</h3>
                <p>
                    본 사이트는 Cloudflare CDN 및 보안 서비스를 이용하며, Cloudflare는 보안
                    목적을 위해 다음과 같은 쿠키를 설정할 수 있습니다.
                </p>
                <ul>
                    <li>
                        <strong>__cf_bm:</strong> 봇 관리 목적의 쿠키 (30분 유효)
                    </li>
                    <li>
                        <strong>cf_clearance:</strong> Cloudflare 보안 확인 통과 기록 (최대
                        15분~1일 유효)
                    </li>
                </ul>
                <p>
                    이러한 쿠키는 사이트 운영자가 아닌 Cloudflare에 의해 관리되며, 이용자의
                    개인정보를 식별하는 데 사용되지 않습니다.
                </p>

                <h3>라. Google Analytics</h3>
                <p>
                    서비스 이용 통계 분석을 위해 Google Analytics를 사용합니다. 이를 통해 다음
                    정보가 수집됩니다:
                </p>
                <ul>
                    <li>페이지 방문 기록 및 체류 시간</li>
                    <li>사용자 행동 이벤트 (게시물 작성, 로그인/회원가입 성공·실패 등)</li>
                    <li>브라우저 및 기기 정보</li>
                    <li>대략적인 지리적 위치 (IP 주소 기반, 도시 수준)</li>
                </ul>
            </section>

            {/* 11. 안전성 확보 */}
            <section id="security" className="legal-section">
                <h2>제11조 (개인정보의 안전성 확보 조치)</h2>
                <p>
                    사이트는 「개인정보 보호법」 제29조에 따라 다음과 같이 안전성 확보에 필요한
                    기술적·관리적·물리적 조치를 취하고 있습니다.
                </p>
                <ol>
                    <li>
                        <strong>비밀번호 암호화:</strong> 이용자의 비밀번호는 bcrypt 알고리즘(12
                        라운드)으로 단방향 암호화하여 저장하며, 원본 비밀번호는 저장하지 않습니다.
                    </li>
                    <li>
                        <strong>인증 토큰 보안:</strong> JWT 기반 인증을 HttpOnly 쿠키 채널로
                        처리하며, Access Token은 30분, Refresh Token은 7일의 만료 기간을
                        설정하고 회전 정책을 적용하여 토큰 탈취 및 재사용 위험을 최소화합니다.
                    </li>
                    <li>
                        <strong>네트워크 보안:</strong> Cloudflare CDN 및 WAF(웹 애플리케이션
                        방화벽)를 통해 DDoS 공격 방어, 악성 트래픽 차단 등 네트워크 수준의
                        보안을 적용합니다.
                    </li>
                    <li>
                        <strong>HTTPS 암호화:</strong> 모든 데이터 전송은 SSL/TLS 암호화를 통해
                        보호됩니다.
                    </li>
                    <li>
                        <strong>접근 권한 관리:</strong> 역할 기반 접근 제어(RBAC)를 통해 관리자,
                        학생회, 교사, 학생 등 권한별로 접근 가능한 기능과 데이터를 제한합니다.
                        개인정보(IP 주소, User-Agent 등)에 대한 열람은 관리자로 제한됩니다.
                    </li>
                    <li>
                        <strong>게시물 승인 체계:</strong> 모든 게시물은 관리자 승인 전까지
                        비공개로 처리되어, 부적절한 개인정보 노출을 사전에 방지합니다.
                    </li>
                    <li>
                        <strong>IP 기반 접근 제한:</strong> 회원가입은 울산광역시교육청 IP(범서고등학교)
                        대역에서만 가능하도록 제한하여 외부인의 무분별한 가입을 방지합니다.
                    </li>
                    <li>
                        <strong>입력값 검증 및 필터링:</strong> 닉네임 금칙어 필터링, XSS 방지를
                        위한 HTML 살균(sanitize) 처리, URL 정책 적용 등을 실시합니다.
                    </li>
                </ol>
            </section>

            {/* 12. 책임자 */}
            <section id="officer" className="legal-section">
                <h2>제12조 (개인정보 보호책임자)</h2>
                <p>
                    사이트는 「개인정보 보호법」 제31조에 따라 개인정보 처리에 관한 업무를
                    총괄해서 책임지고, 이용자의 개인정보에 관한 불만 처리 및 피해 구제 등을
                    위하여 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.
                </p>
                <div className="legal-table-wrap">
                    <table className="legal-table">
                        <thead>
                            <tr>
                                <th>구분</th>
                                <th>내용</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>소속</td>
                                <td>범서고등학교 학생회 정보기술부</td>
                            </tr>
                            <tr>
                                <td>담당자</td>
                                <td>한종명</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <p>
                    이용자는 사이트를 이용하면서 발생하는 모든 개인정보 보호 관련 문의,
                    불만처리, 피해구제 등에 관한 사항을 개인정보 보호책임자에게 문의하실 수
                    있습니다.
                </p>
                <h3>권익침해 구제 기관</h3>
                <p>
                    기타 개인정보 침해에 대한 신고나 상담이 필요하신 경우 아래 기관으로
                    문의하시기 바랍니다.
                </p>
                <ul>
                    <li>
                        개인정보 침해신고센터 (한국인터넷진흥원): ☎ 118,{' '}
                        <a href="https://privacy.kisa.or.kr" target="_blank" rel="noopener noreferrer">
                            privacy.kisa.or.kr
                        </a>
                    </li>
                    <li>
                        개인정보 분쟁조정위원회: ☎ 1833-6972,{' '}
                        <a href="https://www.kopico.go.kr" target="_blank" rel="noopener noreferrer">
                            www.kopico.go.kr
                        </a>
                    </li>
                    <li>
                        대검찰청 사이버수사과: ☎ 1301,{' '}
                        <a href="https://www.spo.go.kr" target="_blank" rel="noopener noreferrer">
                            www.spo.go.kr
                        </a>
                    </li>
                    <li>
                        경찰청 사이버수사국: ☎ 182,{' '}
                        <a href="https://ecrm.cyber.go.kr" target="_blank" rel="noopener noreferrer">
                            ecrm.cyber.go.kr
                        </a>
                    </li>
                </ul>
            </section>

            {/* 13. 변경 */}
            <section id="changes" className="legal-section">
                <h2>제13조 (개인정보 처리방침의 변경)</h2>
                <p>
                    이 개인정보처리방침은 2026년 3월 2일부터 적용됩니다.
                </p>
                <p>
                    개인정보처리방침이 변경되는 경우, 변경 사항은 사이트 공지사항을 통해 공지될
                    예정이며, 변경된 개인정보처리방침은 공지한 날로부터 7일 후 시행됩니다. 다만,
                    수집하는 개인정보의 항목, 이용목적의 변경 등 중요한 내용의 변경이 있을
                    경우에는 변경 내용의 시행일 30일 전부터 공지합니다.
                </p>
            </section>

            {/* Footer */}
            <footer className="legal-footer">
                <p>본 개인정보처리방침은 2026년 3월 2일에 제정되었습니다.</p>
                <button className="legal-back-top" onClick={scrollToTop} type="button">
                    ↑ 맨 위로
                </button>
            </footer>
        </div>
    );
}
