import json
import numpy as np


class CalibrationData:
    def __init__(self, cal_file=None):
        if cal_file is None:
            self.mtx = None
            self.dist = None
        else:
            with open(cal_file, 'r') as f:
                cal_data = json.load(f)
                self.mtx = np.asarray(cal_data['mtx'])
                self.dist = np.asarray(cal_data['dist'])

    def store(self, cal_file, mtx, dist):
        self.mtx = mtx
        self.dist = dist
        cal_data = {
            'mtx': mtx.tolist(),
            'dist': dist.tolist()
        }
        with open(cal_file, 'w') as f:
            json.dump(cal_data, f)
            print('Stored camera calibration to {}'.format(cal_file))
