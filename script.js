// 캔버스 및 컨트롤 요소 가져오기
const canvas = document.getElementById('simulationCanvas');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('startBtn');
const resetBtn = document.getElementById('resetBtn');
const clearBtn = document.getElementById('clearBtn');
const slopeAngleSlider = document.getElementById('slopeAngle');
const frictionSlider = document.getElementById('friction');
const angleValueSpan = document.getElementById('angleValue');
const frictionValueSpan = document.getElementById('frictionValue');

// 편집 모드 버튼
const drawPathBtn = document.getElementById('drawPathBtn');
const addObstacleBtn = document.getElementById('addObstacleBtn');
const eraseBtn = document.getElementById('eraseBtn');
const obstacleTypeSelect = document.getElementById('obstacleType');

// 캔버스 크기 설정
function resizeCanvas() {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
}

// 편집 모드
const EDIT_MODES = {
    DRAW_PATH: 'drawPath',
    ADD_OBSTACLE: 'addObstacle',
    ERASE: 'erase'
};

// 장애물 유형
const OBSTACLE_TYPES = {
    BLOCK: 'block',
    BOUNCE: 'bounce',
    TELEPORT: 'teleport'
};

// 초기 설정
let isSimulating = false;
let isDrawing = false;
let currentEditMode = EDIT_MODES.DRAW_PATH;
let currentObstacleType = OBSTACLE_TYPES.BLOCK;

let ball = {
    x: 0,
    y: 0,
    radius: 20,
    rotation: 0, // 회전 각도
    velocity: 0,
    velocityX: 0,
    velocityY: 0,
    onPath: true // 공이 경로 위에 있는지 여부
};

let slope = {
    angle: 30,
    friction: 0.05
};

// 경로와 장애물 저장
let paths = [];
let currentPath = [];
let obstacles = [];

// 텔레포트 포인트 저장
let teleportPoints = [];
let activeTeleportId = null;

// 경로 그리기 함수
function drawPaths() {
    // 저장된 모든 경로 그리기
    paths.forEach(path => {
        if (path.length < 2) return;
        
        ctx.beginPath();
        ctx.moveTo(path[0].x, path[0].y);
        
        for (let i = 1; i < path.length; i++) {
            ctx.lineTo(path[i].x, path[i].y);
        }
        
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#8e44ad';
        ctx.stroke();
    });
    
    // 현재 그리고 있는 경로 그리기 (미리보기)
    if (currentPath.length > 1 && isDrawing) {
        ctx.beginPath();
        ctx.moveTo(currentPath[0].x, currentPath[0].y);
        
        for (let i = 1; i < currentPath.length; i++) {
            ctx.lineTo(currentPath[i].x, currentPath[i].y);
        }
        
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#27ae60';
        ctx.stroke();
    }
}

// 장애물 그리기 함수
function drawObstacles() {
    obstacles.forEach(obstacle => {
        ctx.save();
        
        switch(obstacle.type) {
            case OBSTACLE_TYPES.BLOCK:
                ctx.fillStyle = '#e74c3c';
                ctx.fillRect(obstacle.x - obstacle.width/2, obstacle.y - obstacle.height/2, obstacle.width, obstacle.height);
                break;
                
            case OBSTACLE_TYPES.BOUNCE:
                ctx.fillStyle = '#f39c12';
                ctx.fillRect(obstacle.x - obstacle.width/2, obstacle.y - obstacle.height/2, obstacle.width, obstacle.height);
                
                // 튕기는 효과 표시
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 3]);
                ctx.strokeRect(obstacle.x - obstacle.width/2 + 3, obstacle.y - obstacle.height/2 + 3, obstacle.width - 6, obstacle.height - 6);
                break;
                
            case OBSTACLE_TYPES.TELEPORT:
                // 텔레포트 포인트 그리기
                ctx.fillStyle = '#3498db';
                ctx.beginPath();
                ctx.arc(obstacle.x, obstacle.y, obstacle.radius, 0, Math.PI * 2);
                ctx.fill();
                
                // 텔레포트 ID 표시
                ctx.fillStyle = '#ffffff';
                ctx.font = '12px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(obstacle.teleportId, obstacle.x, obstacle.y);
                break;
        }
        
        ctx.restore();
    });
}

// 경사면 그리기 (초기 기본 경로)
function drawSlope() {
    const slopeHeight = canvas.height * 0.8;
    const slopeWidth = canvas.width * 0.8;
    const startX = canvas.width * 0.1;
    const startY = canvas.height * 0.1;
    const endX = startX + slopeWidth;
    const endY = startY + slopeHeight;
    
    // 경사각에 따른 경사면 계산
    const radians = (slope.angle * Math.PI) / 180;
    const slopeLength = slopeHeight / Math.sin(radians);
    const slopeEndX = startX + slopeLength * Math.cos(radians);
    const slopeEndY = endY;
    
    // 경사면 그리기 (사용자가 경로를 그리지 않은 경우에만)
    if (paths.length === 0) {
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(slopeEndX, slopeEndY);
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#8e44ad';
        ctx.stroke();
        
        // 경사면 아래 바닥 그리기
        ctx.beginPath();
        ctx.moveTo(slopeEndX, slopeEndY);
        ctx.lineTo(endX, slopeEndY);
        ctx.stroke();
    }
    
    return { startX, startY, slopeEndX, slopeEndY, radians };
}

// 점과 선 사이의 거리 계산 함수
function distanceToLine(point, lineStart, lineEnd) {
    const A = point.x - lineStart.x;
    const B = point.y - lineStart.y;
    const C = lineEnd.x - lineStart.x;
    const D = lineEnd.y - lineStart.y;
    
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    
    if (lenSq !== 0) {
        param = dot / lenSq;
    }
    
    let xx, yy;
    
    if (param < 0) {
        xx = lineStart.x;
        yy = lineStart.y;
    } else if (param > 1) {
        xx = lineEnd.x;
        yy = lineEnd.y;
    } else {
        xx = lineStart.x + param * C;
        yy = lineStart.y + param * D;
    }
    
    const dx = point.x - xx;
    const dy = point.y - yy;
    
    return Math.sqrt(dx * dx + dy * dy);
}

// 공이 경로 위에 있는지 확인하는 함수
function isBallOnPath() {
    // 사용자가 경로를 그리지 않은 경우 기본 경사면 사용
    if (paths.length === 0) {
        const slopeInfo = drawSlope();
        const distance = distanceToLine(
            {x: ball.x, y: ball.y},
            {x: slopeInfo.startX, y: slopeInfo.startY},
            {x: slopeInfo.slopeEndX, y: slopeInfo.slopeEndY}
        );
        
        return distance < ball.radius;
    }
    
    // 사용자가 그린 경로 확인
    for (const path of paths) {
        if (path.length < 2) continue;
        
        for (let i = 0; i < path.length - 1; i++) {
            const distance = distanceToLine(
                {x: ball.x, y: ball.y},
                {x: path[i].x, y: path[i].y},
                {x: path[i+1].x, y: path[i+1].y}
            );
            
            if (distance < ball.radius) {
                return true;
            }
        }
    }
    
    return false;
}

// 공과 장애물 충돌 확인 함수
function checkObstacleCollision() {
    for (const obstacle of obstacles) {
        switch(obstacle.type) {
            case OBSTACLE_TYPES.BLOCK:
                // 블록 충돌 확인
                if (ball.x + ball.radius > obstacle.x - obstacle.width/2 &&
                    ball.x - ball.radius < obstacle.x + obstacle.width/2 &&
                    ball.y + ball.radius > obstacle.y - obstacle.height/2 &&
                    ball.y - ball.radius < obstacle.y + obstacle.height/2) {
                    
                    // 충돌 방향 결정 및 위치 조정
                    const overlapLeft = (ball.x + ball.radius) - (obstacle.x - obstacle.width/2);
                    const overlapRight = (obstacle.x + obstacle.width/2) - (ball.x - ball.radius);
                    const overlapTop = (ball.y + ball.radius) - (obstacle.y - obstacle.height/2);
                    const overlapBottom = (obstacle.y + obstacle.height/2) - (ball.y - ball.radius);
                    
                    // 가장 작은 겹침 찾기
                    const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);
                    
                    // 겹침에 따라 공 위치 조정
                    if (minOverlap === overlapLeft) {
                        ball.x = obstacle.x - obstacle.width/2 - ball.radius;
                        ball.velocityX = 0;
                    } else if (minOverlap === overlapRight) {
                        ball.x = obstacle.x + obstacle.width/2 + ball.radius;
                        ball.velocityX = 0;
                    } else if (minOverlap === overlapTop) {
                        ball.y = obstacle.y - obstacle.height/2 - ball.radius;
                        ball.velocityY = 0;
                    } else if (minOverlap === overlapBottom) {
                        ball.y = obstacle.y + obstacle.height/2 + ball.radius;
                        ball.velocityY = 0;
                    }
                    
                    // 속도 감소
                    ball.velocity *= 0.5;
                    return true;
                }
                break;
                
            case OBSTACLE_TYPES.BOUNCE:
                // 튕기는 벽 충돌 확인
                if (ball.x + ball.radius > obstacle.x - obstacle.width/2 &&
                    ball.x - ball.radius < obstacle.x + obstacle.width/2 &&
                    ball.y + ball.radius > obstacle.y - obstacle.height/2 &&
                    ball.y - ball.radius < obstacle.y + obstacle.height/2) {
                    
                    // 충돌 방향 결정 및 위치 조정
                    const overlapLeft = (ball.x + ball.radius) - (obstacle.x - obstacle.width/2);
                    const overlapRight = (obstacle.x + obstacle.width/2) - (ball.x - ball.radius);
                    const overlapTop = (ball.y + ball.radius) - (obstacle.y - obstacle.height/2);
                    const overlapBottom = (obstacle.y + obstacle.height/2) - (ball.y - ball.radius);
                    
                    // 가장 작은 겹침 찾기
                    const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);
                    
                    // 겹침에 따라 공 위치 조정 및 속도 반전
                    if (minOverlap === overlapLeft || minOverlap === overlapRight) {
                        ball.velocityX = -ball.velocityX * 1.2; // 속도 증가하며 튕김
                        
                        if (minOverlap === overlapLeft) {
                            ball.x = obstacle.x - obstacle.width/2 - ball.radius;
                        } else {
                            ball.x = obstacle.x + obstacle.width/2 + ball.radius;
                        }
                    } else {
                        ball.velocityY = -ball.velocityY * 1.2; // 속도 증가하며 튕김
                        
                        if (minOverlap === overlapTop) {
                            ball.y = obstacle.y - obstacle.height/2 - ball.radius;
                        } else {
                            ball.y = obstacle.y + obstacle.height/2 + ball.radius;
                        }
                    }
                    
                    return true;
                }
                break;
                
            case OBSTACLE_TYPES.TELEPORT:
                // 텔레포트 포인트 충돌 확인
                const dx = ball.x - obstacle.x;
                const dy = ball.y - obstacle.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < ball.radius + obstacle.radius) {
                    // 텔레포트 처리
                    if (activeTeleportId !== obstacle.teleportId) {
                        // 같은 ID의 다른 텔레포트 포인트 찾기
                        const targetTeleport = obstacles.find(o => 
                            o.type === OBSTACLE_TYPES.TELEPORT && 
                            o.teleportId === obstacle.teleportId && 
                            o !== obstacle
                        );
                        
                        if (targetTeleport) {
                            // 텔레포트 실행
                            ball.x = targetTeleport.x;
                            ball.y = targetTeleport.y;
                            
                            // 텔레포트 ID 저장 (연속 텔레포트 방지)
                            activeTeleportId = obstacle.teleportId;
                            
                            // 잠시 후 활성 텔레포트 ID 초기화
                            setTimeout(() => {
                                activeTeleportId = null;
                            }, 1000);
                            
                            return true;
                        }
                    }
                }
                break;
        }
    }
    
    return false;
}

// 공 그리기
function drawBall(x, y, rotation) {
    ctx.save();
    
    // 공 그리기
    ctx.beginPath();
    ctx.arc(x, y, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#e74c3c';
    ctx.fill();
    
    // 공의 회전을 표시하기 위한 선 그리기
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -ball.radius);
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    ctx.restore();
}

// 시뮬레이션 초기화
function initSimulation() {
    resizeCanvas();
    
    // 슬라이더 값 업데이트
    slope.angle = parseInt(slopeAngleSlider.value);
    slope.friction = parseInt(frictionSlider.value) / 100;
    
    // 슬라이더 표시값 업데이트
    angleValueSpan.textContent = slope.angle;
    frictionValueSpan.textContent = slope.friction.toFixed(2);
    
    // 경사면 정보 가져오기
    const slopeInfo = drawSlope();
    
    // 공의 초기 위치 설정 (경사면 위쪽)
    if (paths.length === 0) {
        // 기본 경사면 사용
        ball.x = slopeInfo.startX;
        ball.y = slopeInfo.startY;
    } else {
        // 첫 번째 경로의 첫 번째 점 사용
        ball.x = paths[0][0].x;
        ball.y = paths[0][0].y;
    }
    
    ball.velocity = 0;
    ball.velocityX = 0;
    ball.velocityY = 0;
    ball.rotation = 0;
    ball.onPath = true;
    
    // 캔버스 지우기
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 경로 그리기
    drawPaths();
    
    // 장애물 그리기
    drawObstacles();
    
    // 경사면 그리기 (경로가 없는 경우)
    drawSlope();
    
    // 공 그리기
    drawBall(ball.x, ball.y, ball.rotation);
}

// 시뮬레이션 업데이트
function updateSimulation() {
    if (!isSimulating) return;
    
    // 캔버스 지우기
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 경로 그리기
    drawPaths();
    
    // 장애물 그리기
    drawObstacles();
    
    // 경사면 그리기 (경로가 없는 경우)
    const slopeInfo = drawSlope();
    
    // 중력 가속도 (픽셀/초^2)
    const gravity = 9.8 * 60; // 스케일 조정
    
    // 공이 경로 위에 있는지 확인
    ball.onPath = isBallOnPath();
    
    if (ball.onPath) {
        // 경로 위에 있는 경우
        if (paths.length === 0) {
            // 기본 경사면 사용
            const acceleration = gravity * Math.sin(slopeInfo.radians) - (slope.friction * gravity * Math.cos(slopeInfo.radians));
            ball.velocity += acceleration * 0.016;
            
            const distance = ball.velocity * 0.016;
            ball.x += distance * Math.cos(slopeInfo.radians);
            ball.y += distance * Math.sin(slopeInfo.radians);
            
            // 공의 회전 업데이트 (속도에 비례)
            ball.rotation += (distance / ball.radius);
            
            // 바닥에 도달했는지 확인
            if (ball.y >= slopeInfo.slopeEndY - ball.radius) {
                ball.y = slopeInfo.slopeEndY - ball.radius;
                
                // 바닥에서의 마찰 적용
                ball.velocity *= 0.98;
                
                // 속도가 매우 작으면 정지
                if (Math.abs(ball.velocity) < 0.1) {
                    ball.velocity = 0;
                    isSimulating = false;
                    startBtn.textContent = '시작';
                }
            }
            
            // 경사면 끝에 도달했는지 확인
            if (ball.x >= slopeInfo.slopeEndX) {
                // 바닥을 따라 굴러가도록 설정
                ball.y = slopeInfo.slopeEndY - ball.radius;
            }
        } else {
            // 사용자가 그린 경로 사용
            // 경로를 따라 공의 이동 방향 계산
            let nearestPathSegment = null;
            let minDistance = Infinity;
            let nearestPoint = { x: 0, y: 0 };
            
            // 가장 가까운 경로 세그먼트 찾기
            for (const path of paths) {
                if (path.length < 2) continue;
                
                for (let i = 0; i < path.length - 1; i++) {
                    const p1 = path[i];
                    const p2 = path[i+1];
                    
                    const A = ball.x - p1.x;
                    const B = ball.y - p1.y;
                    const C = p2.x - p1.x;
                    const D = p2.y - p1.y;
                    
                    const dot = A * C + B * D;
                    const lenSq = C * C + D * D;
                    let param = -1;
                    
                    if (lenSq !== 0) {
                        param = dot / lenSq;
                    }
                    
                    let xx, yy;
                    
                    if (param < 0) {
                        xx = p1.x;
                        yy = p1.y;
                    } else if (param > 1) {
                        xx = p2.x;
                        yy = p2.y;
                    } else {
                        xx = p1.x + param * C;
                        yy = p1.y + param * D;
                    }
                    
                    const dx = ball.x - xx;
                    const dy = ball.y - yy;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance < minDistance) {
                        minDistance = distance;
                        nearestPathSegment = { p1, p2 };
                        nearestPoint = { x: xx, y: yy };
                    }
                }
            }
            
            if (nearestPathSegment) {
                // 경로를 따라 공 이동
                const p1 = nearestPathSegment.p1;
                const p2 = nearestPathSegment.p2;
                
                // 경로의 기울기 계산
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const pathAngle = Math.atan2(dy, dx);
                
                // 경로의 기울기에 따른 중력 가속도 계산
                const pathGradient = Math.sin(pathAngle);
                const acceleration = gravity * pathGradient - (slope.friction * gravity * Math.cos(pathAngle));
                
                // 속도 업데이트
                ball.velocity += acceleration * 0.016;
                
                // 경로를 따라 공 이동
                const distance = ball.velocity * 0.016;
                ball.x += distance * Math.cos(pathAngle);
                ball.y += distance * Math.sin(pathAngle);
                
                // 공의 회전 업데이트
                ball.rotation += (distance / ball.radius);
                
                // 경로에서 벗어나는지 계속 확인
                ball.onPath = isBallOnPath();
            }
        }
    } else {
        // 경로에서 벗어난 경우 - 자유 떨어지기
        // 중력 적용
        ball.velocityY += gravity * 0.016 * 0.1; // 중력 가속도 조절
        
        // 위치 업데이트
        ball.x += ball.velocityX * 0.016;
        ball.y += ball.velocityY * 0.016;
        
        // 바닥에 도달했는지 확인
        if (ball.y >= canvas.height - ball.radius) {
            ball.y = canvas.height - ball.radius;
            ball.velocityY = -ball.velocityY * 0.6; // 반발 계수
            ball.velocityX *= 0.8; // 마찰
            
            // 속도가 매우 작으면 정지
            if (Math.abs(ball.velocityY) < 0.5 && Math.abs(ball.velocityX) < 0.5) {
                ball.velocityX = 0;
                ball.velocityY = 0;
                isSimulating = false;
                startBtn.textContent = '시작';
            }
        }
        
        // 좌우 벽에 도달했는지 확인
        if (ball.x <= ball.radius) {
            ball.x = ball.radius;
            ball.velocityX = -ball.velocityX * 0.8;
        } else if (ball.x >= canvas.width - ball.radius) {
            ball.x = canvas.width - ball.radius;
            ball.velocityX = -ball.velocityX * 0.8;
        }
        
        // 공 회전 업데이트
        ball.rotation += (ball.velocityX / ball.radius) * 0.016;
    }
    
    // 장애물 충돌 확인
    checkObstacleCollision();
    
    // 공 그리기
    drawBall(ball.x, ball.y, ball.rotation);
    
    // 다음 프레임 요청
    if (isSimulating) {
        requestAnimationFrame(updateSimulation);
    }
}

// 편집 모드 변경 함수
function setEditMode(mode) {
    currentEditMode = mode;
    
    // 모드 버튼 활성화 상태 업데이트
    drawPathBtn.classList.remove('active');
    addObstacleBtn.classList.remove('active');
    eraseBtn.classList.remove('active');
    
    switch(mode) {
        case EDIT_MODES.DRAW_PATH:
            drawPathBtn.classList.add('active');
            break;
        case EDIT_MODES.ADD_OBSTACLE:
            addObstacleBtn.classList.add('active');
            break;
        case EDIT_MODES.ERASE:
            eraseBtn.classList.add('active');
            break;
    }
}

// 장애물 생성 함수
function createObstacle(x, y, type) {
    switch(type) {
        case OBSTACLE_TYPES.BLOCK:
            obstacles.push({
                type: OBSTACLE_TYPES.BLOCK,
                x: x,
                y: y,
                width: 40,
                height: 40
            });
            break;
            
        case OBSTACLE_TYPES.BOUNCE:
            obstacles.push({
                type: OBSTACLE_TYPES.BOUNCE,
                x: x,
                y: y,
                width: 40,
                height: 40
            });
            break;
            
        case OBSTACLE_TYPES.TELEPORT:
            // 텔레포트 ID 생성 (같은 ID를 가진 텔레포트 포인트끼리 연결)
            let teleportId = 1;
            
            // 텔레포트 포인트의 가장 큰 ID 찾기
            const teleportObstacles = obstacles.filter(o => o.type === OBSTACLE_TYPES.TELEPORT);
            if (teleportObstacles.length > 0) {
                const maxId = Math.max(...teleportObstacles.map(o => o.teleportId));
                teleportId = maxId + 1;
                
                // 같은 ID의 텔레포트 포인트가 이미 2개 이상 있는 경우
                const existingPairs = teleportObstacles.filter(o => o.teleportId === teleportId);
                if (existingPairs.length >= 2) {
                    teleportId = maxId + 1;
                }
            }
            
            obstacles.push({
                type: OBSTACLE_TYPES.TELEPORT,
                x: x,
                y: y,
                radius: 20,
                teleportId: teleportId
            });
            break;
    }
    
    // 캔버스 다시 그리기
    if (!isSimulating) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawPaths();
        drawObstacles();
        drawSlope();
        drawBall(ball.x, ball.y, ball.rotation);
    }
}

// 장애물 삭제 함수
function eraseObstaclesAt(x, y, radius = 20) {
    obstacles = obstacles.filter(obstacle => {
        if (obstacle.type === OBSTACLE_TYPES.TELEPORT) {
            const dx = obstacle.x - x;
            const dy = obstacle.y - y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            return distance > radius;
        } else {
            // 블록 또는 튕기는 벽
            return !(x >= obstacle.x - obstacle.width/2 - radius &&
                   x <= obstacle.x + obstacle.width/2 + radius &&
                   y >= obstacle.y - obstacle.height/2 - radius &&
                   y <= obstacle.y + obstacle.height/2 + radius);
        }
    });
}

// 경로 삭제 함수
function erasePathsAt(x, y, radius = 10) {
    // 각 경로의 각 세그먼트를 확인하여 지우기 범위에 있는 세그먼트 삭제
    paths = paths.map(path => {
        if (path.length < 2) return path;
        
        // 삭제할 점 찾기
        const pointsToRemove = [];
        for (let i = 0; i < path.length; i++) {
            const dx = path[i].x - x;
            const dy = path[i].y - y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < radius) {
                pointsToRemove.push(i);
            }
        }
        
        // 점 삭제
        if (pointsToRemove.length > 0) {
            return path.filter((_, index) => !pointsToRemove.includes(index));
        }
        
        return path;
    }).filter(path => path.length >= 2); // 점이 2개 미만인 경로는 삭제
}

// 캔버스 마우스 이벤트 처리
canvas.addEventListener('mousedown', (e) => {
    if (isSimulating) return; // 시뮬레이션 중에는 편집 불가
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    switch(currentEditMode) {
        case EDIT_MODES.DRAW_PATH:
            isDrawing = true;
            currentPath = [{ x, y }];
            break;
            
        case EDIT_MODES.ADD_OBSTACLE:
            // 장애물 추가
            currentObstacleType = obstacleTypeSelect.value;
            createObstacle(x, y, currentObstacleType);
            break;
            
        case EDIT_MODES.ERASE:
            isDrawing = true;
            // 장애물 및 경로 삭제
            eraseObstaclesAt(x, y);
            erasePathsAt(x, y);
            
            // 캔버스 다시 그리기
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            drawPaths();
            drawObstacles();
            drawSlope();
            drawBall(ball.x, ball.y, ball.rotation);
            break;
    }
});

canvas.addEventListener('mousemove', (e) => {
    if (!isDrawing || isSimulating) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    switch(currentEditMode) {
        case EDIT_MODES.DRAW_PATH:
            // 경로 그리기 - 현재 경로에 점 추가
            currentPath.push({ x, y });
            
            // 미리보기 그리기
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            drawPaths();
            drawObstacles();
            drawSlope();
            drawBall(ball.x, ball.y, ball.rotation);
            break;
            
        case EDIT_MODES.ERASE:
            // 지우기 - 드래그하면서 지우기
            eraseObstaclesAt(x, y);
            erasePathsAt(x, y);
            
            // 캔버스 다시 그리기
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            drawPaths();
            drawObstacles();
            drawSlope();
            drawBall(ball.x, ball.y, ball.rotation);
            break;
    }
});

canvas.addEventListener('mouseup', () => {
    if (isSimulating) return;
    
    if (isDrawing && currentEditMode === EDIT_MODES.DRAW_PATH && currentPath.length > 1) {
        // 경로 그리기 완료 - 경로 저장
        paths.push([...currentPath]);
        currentPath = [];
    }
    
    isDrawing = false;
});

canvas.addEventListener('mouseleave', () => {
    if (isDrawing && currentEditMode === EDIT_MODES.DRAW_PATH && currentPath.length > 1) {
        // 캔버스를 나갔을 때 경로 저장
        paths.push([...currentPath]);
        currentPath = [];
    }
    
    isDrawing = false;
});

// 편집 모드 버튼 이벤트
drawPathBtn.addEventListener('click', () => {
    setEditMode(EDIT_MODES.DRAW_PATH);
});

addObstacleBtn.addEventListener('click', () => {
    setEditMode(EDIT_MODES.ADD_OBSTACLE);
});

eraseBtn.addEventListener('click', () => {
    setEditMode(EDIT_MODES.ERASE);
});

// 모두 지우기 버튼
clearBtn.addEventListener('click', () => {
    paths = [];
    obstacles = [];
    currentPath = [];
    
    // 캔버스 다시 그리기
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawPaths();
    drawObstacles();
    drawSlope();
    drawBall(ball.x, ball.y, ball.rotation);
});

// 시뮬레이션 제어 버튼 이벤트
startBtn.addEventListener('click', () => {
    isSimulating = !isSimulating;
    startBtn.textContent = isSimulating ? '일시정지' : '시작';
    
    if (isSimulating) {
        updateSimulation();
    }
});

resetBtn.addEventListener('click', () => {
    isSimulating = false;
    startBtn.textContent = '시작';
    initSimulation();
});

slopeAngleSlider.addEventListener('input', () => {
    slope.angle = parseInt(slopeAngleSlider.value);
    angleValueSpan.textContent = slope.angle;
    
    if (!isSimulating) {
        initSimulation();
    }
});

frictionSlider.addEventListener('input', () => {
    slope.friction = parseInt(frictionSlider.value) / 100;
    frictionValueSpan.textContent = slope.friction.toFixed(2);
    
    if (!isSimulating) {
        initSimulation();
    }
});

// 창 크기 변경 시 캔버스 크기 조정
window.addEventListener('resize', () => {
    if (!isSimulating) {
        initSimulation();
    }
});

// 초기화
window.addEventListener('load', () => {
    // 초기 편집 모드 설정
    setEditMode(EDIT_MODES.DRAW_PATH);
    initSimulation();
});
