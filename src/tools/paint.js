import Tool from './base.js';
import { point_direction } from '../utils/point_direction.js';

import storeSingleton from "../foundation/store.js";
import { toolId } from '../frame/tools.js';

class Paint extends Tool {
	constructor() {
		super();
		this.previousPoint = null;
		this.brushSize = 10;
		this.brushShape = "flat"; // square or flat or round
		this.color = 0xffffff;

		// special brush params
		this.shouldRotateBrush = true;

		// TODO: implement
		this.shouldUsePenPressure = true;
				
		// prepare circle texture, that will be our brush
		this.brush = new PIXI.Graphics();
		this.lineBrush = new PIXI.Graphics();
		this.lineStyle = {};
		this.toolType = toolId.PAINT;

		this.subscribe();
		this.updateBrush();

		this.stroke = [];
	}

	subscribe() {
		this.brushSize = storeSingleton.get('paint.size') || 1;
		this.brushShape = storeSingleton.get('paint.shape') || 'flat';
		storeSingleton.subscribe('paint.size', (newSize) => {
			this.updateBrush({
				size: newSize
			});
		})

		storeSingleton.subscribe('paint.shape', (newShape) => {
			this.updateBrush({
				shape: newShape
			});
		})

		storeSingleton.subscribe('color', (color) => {
			this.updateBrush({ color });
		})

		storeSingleton.update('paint.shape', this.brushShape);
	}

	updateBrush({size, shape, color} = {}) {
		this.brushSize = size || this.brushSize;
		this.brushShape = shape || this.brushShape;
		if (color !== undefined && color !== null) {
			this.color = color;
		}
		
		this.brush.angle = 0;

		this._updateBrushTemporary(this.brushSize, this.brushShape, this.color);
	}

	_updateBrushTemporary(size, shape, color) {
		this.brush.clear();
		this.brush.beginFill(color);
		if (size === 1) {
			this.brush.drawRect(0, 0, 1, 1);
		} else if (size > 1 && shape === "round") {
			this.brush.drawCircle(0, 0, size / 2);
			this.shouldRotateBrush = false;
		} else if (size > 1 && shape === "flat") {
			this.brush.drawRect(-Math.ceil(size/4), -Math.ceil(size/2), size/2, size);
			this.shouldRotateBrush = true;
		} else {
			this.brush.drawRect(-Math.ceil(size/2), -Math.ceil(size/2), size, size);
			this.shouldRotateBrush = false;
		}
		this.brush.endFill();
		this.lineStyle = {
			width: size,
			color: color,
			native: false,
		};
	}

	begin(renderer, renderTexture, event, artwork) {
		this.stroke = []
		this.move(renderer, renderTexture, event, artwork);
	}

	move(renderer, renderTexture, event, artwork) {
		const viewport = artwork.getViewport();
		
		let newPoint = new PIXI.Point(this.getX(event, viewport), this.getY(event, viewport));
		if (this.previousPoint && Math.abs(this.previousPoint.x - newPoint.x) < 0.01 && Math.abs(this.previousPoint.y - newPoint.y) < 0.01) {
			return; // abort early, nothing moved.
		}

		if (this.previousPoint) {
			if (this.shouldRotateBrush && this.brushSize > 1) {
				this.brush.angle = point_direction(this.previousPoint.x, this.previousPoint.y, newPoint.x, newPoint.y);
			}
			this._strokeLine(renderer, renderTexture, newPoint, this.previousPoint);
		} 
		
		this._strokePoint(renderer, renderTexture, newPoint.x, newPoint.y);

		this.stroke.push({
			x: newPoint.x,
			y: newPoint.y,
			size: this.brushSize,
			angle: this.brush.angle,
			shape: this.brushShape,
			color: this.color,
		});

		this.previousPoint = newPoint;
	}

	_strokePoint(renderer, renderTexture, x, y) {
		this.brush.position.x = x;
		this.brush.position.y = y;

		renderer.render(this.brush, renderTexture, false, null, false);
	}

	_strokeLine(renderer, renderTexture, newPoint, previousPoint) {
		this.lineBrush.clear();
		this.lineBrush.lineStyle(this.lineStyle);
		this.lineBrush.moveTo(previousPoint.x + 0.5, previousPoint.y + 0.5)
		this.lineBrush.lineTo(newPoint.x + 0.5, newPoint.y + 0.5)

		renderer.render(this.lineBrush, renderTexture, false, null, false);
	}

	end(renderer, renderTexture, event, artwork) {
		const viewport = artwork.getViewport();

		let x = this.getX(event, viewport);
		let y = this.getY(event, viewport);

		this.stroke.push({
			x: x,
			y: y,
			size: this.brushSize,
			angle: this.brush.angle,
			shape: this.brushShape,
			color: this.color,
		});

		this._strokePoint(renderer, renderTexture, x, y);
		this.previousPoint = null;

		artwork.addUndoable(this.toolType, this.stroke);
	}

	applyOperation(operation, renderer, renderTexture) {
		let prev = undefined;

		// should be a stroke object
		for (let point of operation) {
			this._updateBrushTemporary(point.size, point.shape, point.color);
			if (prev) {
				this.brush.angle = point.angle;
				this._strokeLine(renderer, renderTexture, point, prev);	
			}
			this._strokePoint(renderer, renderTexture, point.x, point.y);

			prev = point;
		}
		this.updateBrush();
	}
}

export default Paint;