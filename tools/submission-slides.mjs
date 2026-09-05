// Run a copy in an external build directory linked to the bundled node_modules.
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Presentation, PresentationFile } from '@oai/artifact-tool';
const [repo, work, skill, python] = process.argv.slice(2);
const base = 'd3d1a1a2903c558778eef7be0f249057e40ee769';
const url = name => `https://github.com/AI-HealthCare-05/AH_05_07/blob/${base}/${name}`;
const evidence = JSON.parse(await fs.readFile(path.join(repo, 'docs/evidence/model-uncertainty.json'), 'utf8'));
const comparison = JSON.parse(await fs.readFile(path.join(repo, 'docs/evidence/model-comparison.json'), 'utf8'));
const p = Presentation.create({ slideSize: { width: 1280, height: 720 } });
const font = 'Malgun Gothic', ink = '#183136', teal = '#32685E', muted = '#57645F', amber = '#956132';
function text(s, value, x, y, w, h, size=28, color=ink, bold=false) {
  const shape = s.shapes.add({ geometry: 'textbox', position: { left:x, top:y, width:w, height:h }, fill:'none', line:{fill:'none',width:0} });
  shape.text=value; shape.text.style={typeface:font,fontSize:size,color,bold,autoFit:'none'}; return shape;
}
function slide(title, sources, note='') {
  const s=p.slides.add(); s.background.fill='#F7F7F2';
  text(s,title,60,42,1160,94,44,ink,true);
  text(s,`제출 검토본 · ${p.slides.items.length}/7 · 출처: sk7-mvp1-sources.md`,60,674,650,26,17,muted);
  text(s,'1회차 진행 중',1010,674,210,26,17,amber);
  s.speakerNotes.textFrame.setText(`${note}\n제작 기준: ${base}\n근거:\n${sources.map(url).join('\n')}\n이 파일은 제출 검토본이며 발주사 수용·입력 adapter·모델 선택·출시 승인이 아니다.`);
  return s;
}
function rule(s,x,y,w){ s.shapes.add({geometry:'rect',position:{left:x,top:y,width:w,height:2},fill:'#CCD6CF',line:{fill:'none',width:0}}); }
function table(s,values,x,y,width,height,widths,size=24) {
  const t=s.tables.add({rows:values.length,columns:values[0].length,left:x,top:y,width,height,columnWidths:widths,values});
  t.borders.assign({fill:'#D8DED6',width:1,style:'solid'});
  for(let r=0;r<values.length;r++) for(let c=0;c<values[0].length;c++) {
    const cell=t.getCell(r,c);cell.fill=r===0?teal:'#FFFFFF';
    cell.text.style={typeface:font,fontSize:size,color:r===0?'#FFFFFF':ink,bold:r===0};
  }
  return t;
}
let s=slide('SK7 1회차 제출 검토', ['docs/mvp1-closeout.md','docs/requirements.md'], '발주 필수 요구는 발병 가능성 모델·변화 추이 대시보드·챌린지다. 현재 연구 라벨은 NHANES 조사 시점 BP 임계값이며 미래 발병을 뜻하지 않는다. Talos 원문: https://app.notion.com/p/410f58c8594683eca81581525fe31a8e');
text(s,'기록 서비스의 현재 구현과\n모델 연구의 적용 범위',60,186,1130,180,54,ink,true);
text(s,'혈압 관찰과 7일 챌린지 참여를 구분해 기록합니다.',60,415,1120,65,30);
text(s,'입력 기반 위험군 선별 신호는 준비 중입니다.\n미래 발병 가능성·변화 추이 요구의 범위 수용은 확인 전입니다.',60,510,1120,105,27,amber);
s=slide('현재 제공하는 기록·회고 기능',['web/src/App.tsx','docs/mvp1-validation.md','docs/observation-challenge-contract.md']);
text(s,'본인 기록과 7일 챌린지',60,161,610,50,32,teal,true);
text(s,'현재·이전 7일 기록을 살펴봅니다.\n선택한 기록은 상세 화면에서 확인합니다.',60,226,620,135,28);
text(s,'혈압 관찰과 챌린지 참여를 구분합니다.\n빈 상태와 불러오기 실패도 구분합니다.',60,397,620,125,28);
text(s,'오른쪽: 현재 구현의 합성 회고 화면\n실제 계정·운영 저장 증거가 아닙니다.',60,562,610,70,23,muted);
s.images.add({blob:new Uint8Array(await fs.readFile(path.join(repo,'docs/evidence/mvp1/normal-1366.png'))),contentType:'image/png',alt:'합성 기록 회고 화면',fit:'contain',position:{left:705,top:163,width:510,height:478}});
s=slide('기록 경로와 미구현 모델 경로',['docs/architecture.md','docs/diagrams/mvp1-architecture.svg','docs/diagrams/mvp1-erd.svg'], '상세 SVG 원본 2종은 제출 폴더에 별도 포함. 현재 주요 테이블: blood_pressure_observations, challenge_events, active_challenges, challenge_checkins. auth.users 소유권과 active_challenge 복합 FK/RLS. 모델 artifact·assessment 테이블은 목표 구성이다.');
text(s,'현재 구현',60,151,440,46,29,teal,true);
table(s,[['브라우저','FastAPI','Supabase'],['본인 JWT 전달','기록 API','Auth + RLS'],['기록·챌린지·회고','503 model_not_ready','소유자별 접근 제어']],60,212,1160,210,[360,400,400],26);
text(s,'로컬 모델 연구는 위 운영 경로에 연결되어 있지 않습니다.',60,450,1160,50,28);
rule(s,60,513,1160);
text(s,'목표 구성 · 미구현 / 승인 전',60,537,1100,45,29,amber,true);
text(s,'입력 adapter → 선택 모델·artifact → assessment 저장·결과 UI',60,591,1160,45,27,amber);
const m=evidence.groups.overall.metrics;
const f=n=>n.toFixed(4), signed=n=>(n>=0?'+':'')+f(n);
const rows=[['지표','LR','HGB','HGB − LR [95% 구간]']];
for(const [k,label] of [['auroc','AUROC ↑'],['pr_auc','AP ↑'],['brier','Brier ↓']]) {
  const a=m[k];
  if(Math.abs(comparison.models.logistic_regression.overall[k].value-a.point.lr.value)>1e-12) throw Error('Point mismatch');
  rows.push([label,f(a.point.lr.value),f(a.point.hgb.value),`${signed(a.point.difference.value)} [${f(a.interval.difference[0])}, ${f(a.interval.difference[1])}]`]);
}
s=slide('전체 AP 개선 근거와 남은 모델 한계',['docs/evidence/model-comparison.json','docs/evidence/model-uncertainty.json','docs/model-uncertainty-evidence.md','docs/model-card.md'], `원래 비교 실행 ${evidence.original_execution_commit}; 불확실성 실행 ${evidence.execution_commit}. 비교 CONFIG ${evidence.comparison_config_sha256}; 불확실성 CONFIG ${evidence.uncertainty_config_sha256}. 동일 frozen train 5560 / validation1192, train-only 전처리. 2000 paired bootstrap, seed20260901, 양측95% percentile/linear. 기존 결과를 본 후 설계한 탐색적 점별 조건부 구간. 학습 변동성·다중비교·NHANES 복합표본설계 미반영. 집계 verifier는 예측 기반 독립 재계산이 아니다. 전체 AP만 차이 구간이0을 제외한다. 모든 지표 2000 valid/0 invalid. 빈 성별 그룹은 공개값 없음. 상세 모델별 구간: ${JSON.stringify(m)}. 18–39 Brier 및40–59 AUROC 악화도 남음.`);
text(s,'동일 validation 1,192행 · LR과 HGB · 고정 paired bootstrap',60,151,1160,48,25,muted);
table(s,rows,60,213,1160,245,[240,180,180,560],25);
text(s,'AP 차이는 양수 구간입니다. AUROC·Brier 차이 구간은 0을 포함합니다.',60,482,1160,48,25,teal,true);
text(s,'60–80 코드 그룹: HGB AUROC 0.5704 · 392행 (80은 80세 이상 코드)\n낮은 확률 구간의 과소예측, 한국 사용자 일반화, 출시 기준은 미해결입니다.',60,545,1160,90,25,amber);
s=slide('로컬 검사와 운영 검증의 범위',['docs/mvp1-validation.md','docs/mvp1-operations-review.md'], '기존 실행 runtime255c904414943e21ee0a8596690e2a1adebb3ebc, PR226 merge d3d1a1a. Browser26=25+production fixture boundary1. API 초기31pass+DB초기화실패3; 별도메모리SQLite초기화후3pass. pgTAP50중exacttime17. 로컬 API image build와 loopback smoke. PR226 CI lint/test/web/deployment-smoke/browser-e2e5success. 기존 검사 결과를 이번 운영 검증으로 바꾸지 않는다.');
table(s,[['검증 수준','확인한 결과','적용 범위'],['브라우저 합성','26개 통과','흐름·복구·fixture 경계'],['API / store / health','31 + 초기화 보완 3개 통과','분리된 테스트 환경'],['로컬 PostgreSQL','pgTAP 50개 통과','소유권·만료·챌린지'],['로컬 build / smoke','통과','이미지·health·CORS']],60,168,1160,345,[320,410,430],25);
text(s,'운영의 최신 사용자 흐름·만료 행·clean 배포 재현·API P95는 확인 전입니다.',60,561,1140,76,28,amber,true);
s=slide('납품 공백과 제출 일정 영향',['docs/mvp1-closeout.md','docs/mvp1-operations-review.md','docs/model-release-readiness.md'], 'O2는 별도 승인 후 합성 계정을 준비해 실제30일TTL을 기다려야 한다. 2026-09-06 시작을 가정하면 가장 빨라도2026-10-06이므로 기존2026-09-21제출 일정 이전 완료 불가. 이번에 행 생성/대기 시작하지 않았다. 날짜는 가정이며 실제 만료시각과 purge전관찰 창을 별도계획한다. 짧은TTL별도환경/로컬pgTAP를 운영완료로 대체하지 않는다.');
text(s,'발주 요구',60,166,245,50,29,teal,true);
text(s,'미래 발병 가능성·변화 추이와 현재 횡단면 연구의 차이\n범위 수용 또는 추가 데이터·개발·평가가 필요합니다.',330,163,850,108,28);
rule(s,60,301,1160);
text(s,'운영 검증',60,328,245,50,29,teal,true);
text(s,'O2 자연 만료는 승인 후 생성 시점부터 30일 대기\n9월 6일 시작 가정 시 10월 6일 이후: 9월 21일 제출과 충돌',330,326,850,110,27,amber);
rule(s,60,466,1160);
text(s,'사람의 판단',60,494,245,50,29,teal,true);
text(s,'입력 의미·지원 대상, 모델 출시 기준과 범위 수용\n운영 검증 증거와 최종 제출본 검토가 남습니다.',330,491,850,110,28);
s=slide('제출 검토본과 남은 결정',['docs/mvp1-closeout.md','docs/mvp1-demo.md'], '제출7종: 서비스, 요구사항정의서,API명세서,ERD/아키텍처,UI/와이어프레임,시연영상,발표자료. 이번 파일은 검토본이며 납품수용/종료아님. 발주사질의미발송. 영상은무음자막,합성local/mock구분. 사용자화면확인은질문의미adapter모델승인아님.');
text(s,'이번 패키지',60,170,1120,50,31,teal,true);
text(s,'편집 가능한 PPTX·대응 PDF·무음 자막 MP4\n실제/목표 도면·합성 캡처·파일 목록과 재생성 소스',60,240,1120,110,30);
rule(s,60,381,1160);
text(s,'발주사 확인 질의 · 미발송',60,416,1120,50,30,amber,true);
text(s,'기록 서비스·횡단면 연구 보고를 1회차 범위로 수용할 수 있습니까?\n발병 예측·변화 추이가 필수라면 대상·기간·자료·평가 기준을 확인해 주세요.',60,481,1130,110,27);
text(s,'제출 시트 대조와 사용자 최종 검토 전까지 1회차는 진행 중입니다.',60,611,1160,42,24,muted);
await fs.mkdir(path.join(work,'.codex-finalizer'),{recursive:true});
await fs.mkdir(path.join(work,'output'),{recursive:true});
const candidate=path.join(work,'.codex-finalizer/candidate.pptx');
await (await PresentationFile.exportPptx(p)).save(candidate);
const { finalizePresentation }=await import(pathToFileURL(path.join(skill,'container_tools/artifact_tool_utils.mjs')).href);
await finalizePresentation({workspaceDir:work,candidatePath:candidate,finalPath:path.join(work,'output/sk7-mvp1-review-v2.pptx'),pythonExecutable:python,integrityValidatorPath:path.join(skill,'container_tools/inspect_presentation_package_integrity.py'),layoutValidatorPath:path.join(skill,'container_tools/inspect_presentation_layout_geometry.py'),layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-heading-fit','--require-native-table-slide','3','--require-native-table-slide','4','--require-native-table-slide','5'],explicitTotalSlideCount:7,requiredNativeTableOwnerSlides:[3,4,5],fontPolicy:{basis:'design',families:[font]},verifyArtifactToolImport:true,receiptPath:path.join(work,'.codex-finalizer/validation.json')});
console.log('Created editable 7-slide PPTX with source notes and aggregate-derived table.');
